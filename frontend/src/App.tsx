/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/refs */
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import './App.css'

export default function App() {

    const socketRef = useRef<Socket | null>(null);
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const isHostRef = useRef<boolean>(false);
    const dataChannelRef = useRef<Map<string, RTCDataChannel>>(new Map());
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());

    const [roomId, setRoomId] = useState<string>('');
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioURL, setAudioURL] = useState<string | null>(null);

    const createRoom = async () => {
        isHostRef.current = true;
        
        // temporary bypass to get datachannel working
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const newRoomId = Math.random().toString(36).substring(2, 8);
        setRoomId(newRoomId);
        socketRef.current?.emit('join-room', newRoomId);
        console.log(`Created and joined room: ${newRoomId}`);
    };

    const joinRoom = async () => {
        isHostRef.current = false;
        
        // temporary bypass to get datachannel working
        await navigator.mediaDevices.getUserMedia({ audio: true });

        if (roomId.trim() !== '') {
            socketRef.current?.emit('join-room', roomId);
            console.log(`Joined room: ${roomId}`);
        }
    }

    const sendAudioFile = async (): Promise<void> => {
        if (!audioFile) {
            console.log("No audio file selected!");
            return;
        }

        const arrayBuffer = await audioFile.arrayBuffer();
        peersRef.current.forEach((pc, guestId) => {
            const dataChannel = dataChannelRef.current.get(guestId);
            if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(arrayBuffer);
            }
            else {
                console.warn(`Cannot send audio: Data channel is currently ${dataChannel?.readyState}`)
            }
        })
    }

    const createPeerConnection = (targetId: string): RTCPeerConnection => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.oniceconnectionstatechange = () => {
            console.log(`ICE Connection State for ${targetId}:`, pc.iceConnectionState);
        }

        pc.onconnectionstatechange = () => {
            console.log(`Global Connection State for ${targetId}:`, pc.connectionState);
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Found ICE candidate:", event.candidate)

                socketRef.current?.emit('signal', {
                    targetId: targetId,
                    signalData: {
                        type: 'ice-candidate',
                        candidate: event.candidate.toJSON()
                    }
                })
            }
        }

        pc.ondatachannel = (event) => {
            const receiveChannel = event.channel;
            console.log(`Guest caught the data channel from ${targetId}`)

            receiveChannel.onmessage = (messageEvent) => {
                const blob = new Blob([messageEvent.data], {
                    type: 'audio/mpeg'
                });

                const url = URL.createObjectURL(blob);
                console.log('Generated audio URL: ', url);

                setAudioURL(url);
            }
        }

        peersRef.current.set(targetId, pc);
        return pc;
    }

    const initiateHandshake = async (guestSocketId: string): Promise<void> => {
        if (!socketRef.current)
            return;

        const pc = createPeerConnection(guestSocketId);

        //create the data channel and save to map
        const dataChannel = pc.createDataChannel(`sync-channel-${guestSocketId}`);
        dataChannel.onopen = () => {
            console.log(`Data channel open with ${guestSocketId}`);
        };
        dataChannelRef.current.set(guestSocketId, dataChannel);

        //create the SDP offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socketRef.current.emit('signal', {
            targetId: guestSocketId,
            signalData: {
                type: 'offer',
                sdp: offer
            }
        });

        console.log('Sent SDP Offer to Guest');
    }

    useEffect(() => {
        // connecting to our signaling server
        socketRef.current = io('http://localhost:3000');

        socketRef.current.on('connect', () => {
            console.log('Connected to signaling server! My ID:', socketRef.current?.id);
        });

        socketRef.current.on('peer-joined', (guestSocketId: string) => {
            if (isHostRef.current) {
                console.log(`A guest joined with ID: ${guestSocketId}`);
                initiateHandshake(guestSocketId);
            }
        })

        socketRef.current.on('signal', async (data: { senderId: string, signalData: any }) => {
            const { type, sdp } = data.signalData;

            if (type === 'offer') {
                const pc = createPeerConnection(data.senderId);

                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socketRef.current?.emit('signal', {
                    targetId: data.senderId,
                    signalData: {
                        type: 'answer',
                        sdp: answer
                    }
                })
                console.log('Guest: Received Offer, send Answer back')

                if (pendingCandidatesRef.current.has(data.senderId)) {
                    for (const candidate of pendingCandidatesRef.current.get(data.senderId)!) {
                        try {
                            await pc.addIceCandidate(candidate);
                            console.log('Ice candidated added successfully')
                        } catch (error) {
                            console.error('Error adding queued ICE candidate', error);
                        }
                    }
                    pendingCandidatesRef.current.set(data.senderId, []);
                }
            } else if (type === 'answer') {

                const pc = peersRef.current.get(data.senderId);
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                    console.log('Host: Received Answer, handshake complete')

                    if (pendingCandidatesRef.current.has(data.senderId)) {
                        for (const candidate of pendingCandidatesRef.current.get(data.senderId)!) {
                            try {
                                await pc.addIceCandidate(candidate);
                                console.log('Ice candidated added successfully')
                            } catch (error) {
                                console.error('Error adding queued ICE candidate', error);
                            }
                        }
                        pendingCandidatesRef.current.set(data.senderId, []);
                    }
                }
            } else if (type === 'ice-candidate') {

                const pc = peersRef.current.get(data.senderId);

                if (pc) {

                    const iceCandidate = new RTCIceCandidate(data.signalData.candidate);
                    console.log(`Received ICE Candidate from ${data.senderId}`);

                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(iceCandidate);
                        console.log('Ice candidated added successfully')

                    } else {

                        if (!pendingCandidatesRef.current.has(data.senderId)) {
                            pendingCandidatesRef.current.set(data.senderId, []);
                        }

                        pendingCandidatesRef.current
                            .get(data.senderId)!
                            .push(iceCandidate);

                        console.log('Ice candidated queued')
                    }
                }
            }
        })

        return () => {
            socketRef.current?.disconnect();
            peersRef.current?.forEach((value) => {
                value.close();
            })
        }

    }, []) //only runs once

    return (
        <div className='App-container'>
            <h1>P2P Sync App</h1>

            <div className='host-container'>
                <button onClick={createRoom}>Create Party (Host) </button>
                {isHostRef.current && roomId && <p><strong>ROOM ID:</strong>{roomId}</p>}

                {isHostRef.current && (
                    <input
                        className="file-picker"
                        type="file"
                        accept='audio/*'
                        onChange={(e) => {
                            if (e.target.files != null)
                                setAudioFile(e.target.files[0])
                        }}
                    />
                )}

                <button
                    className='send-audiobtn'
                    onClick={sendAudioFile}
                >
                    Send Audio
                </button>
            </div>

            <div className='guest-container'>
                <input
                    className='join-input'
                    type="text"
                    placeholder='Enter Room ID'
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                />
                <button className='join-button' onClick={joinRoom}>Join Party (Guest)</button>
            </div>

            <div className='audio-player'>
                {audioURL && (
                    <audio controls>
                        <source src={audioURL} type="audio/mpeg" />
                    </audio>
                )}
            </div>

        </div>
    )
}

