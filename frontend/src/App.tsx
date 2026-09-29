import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import './App.css'

export default function App() {

    const socketRef = useRef<Socket | null>(null);
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const isHostRef = useRef<boolean>(false);

    const [roomId, setRoomId] = useState<string>('');

    const createRoom = () => {
        isHostRef.current = true;

        const newRoomId = Math.random().toString(36).substring(2, 8);
        setRoomId(newRoomId);
        socketRef.current?.emit('join-room', newRoomId);
        console.log(`Created and joined room: ${newRoomId}`);
    };

    const joinRoom = () => {
        isHostRef.current = false;

        if (roomId.trim() !== '') {
            socketRef.current?.emit('join-room', roomId);
            console.log(`Joined room: ${roomId}`);
        }
    }

    const createPeerConnection = (targetId: string): RTCPeerConnection => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current?.emit('signal', {
                    targetId: targetId,
                    signalData: {
                        type: 'ice-candidate',
                        candidate: event.candidate
                    } 
                })
            }
        }

        pc.ondatachannel = (event) => {
            const receiveChannel = event.channel;
            console.log(`Guest caught the data channel from ${targetId}`)

            receiveChannel.onmessage = (messageEvent) => {
                console.log('Received from host: ', messageEvent.data)
            }
        }

        peersRef.current.set(targetId, pc);
        return pc;
    }

    const initiateHandshake = async (guestSocketId: string): Promise<void> => {
        if (!socketRef.current)
            return;

        const pc = createPeerConnection(guestSocketId);

        const dataChannel = pc.createDataChannel('sync-channel');
        dataChannel.onopen = () => { console.log(`Data channel open with ${guestSocketId}`); };

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

        // //connecting to WebRTC engine
        // const config: RTCConfiguration = {
        //     iceServers: [{
        //         urls: 'stun:stun.l.google.com:19302'
        //     }]
        // }
        // peersRef.current = new RTCPeerConnection(config);

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
            } else if (type === 'answer') {
                const pc = peersRef.current.get(data.senderId);
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                    console.log('Host: Received Answer, handshake complete')
                }
            } else if (type === 'ice-candidate') {
                const pc = peersRef.current.get(data.senderId);
                if (pc) {
                    pc.addIceCandidate(data.signalData.candidate);
                }
            }
        })

        return () => {
            socketRef.current?.disconnect();
            peersRef.current?.forEach((value)=>{
                value.close();
            })
        }

    }, []) //only runs once

    return (
        <div className='App-container'>
            <h1>P2P Sync App</h1>

            <div className='create-party-container'>
                <button onClick={createRoom}>Create Party (Host) </button>
                {isHostRef.current && roomId && <p><strong>ROOM ID:</strong>{roomId}</p>}
            </div>

            <div className='join-party-container'>
                <input
                    className='join-input'
                    type="text"
                    placeholder='Enter Room ID'
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                />
                <button className='join-button' onClick={joinRoom}>Join Party (Guest)</button>
            </div>

        </div>
    )
}

