/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/refs */
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { HostControls } from './components/HostControls';
import { GuestControls } from './components/GuestControls';
import { SyncPlayer } from './components/SyncPlayer';
// import './App.css';
import './App_y2k.css';

export default function App() {

    const socketRef = useRef<Socket | null>(null);
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const isHostRef = useRef<boolean>(false);
    const fileChannelRef = useRef<Map<string, RTCDataChannel>>(new Map());
    const syncChannelRef = useRef<Map<string, RTCDataChannel>>(new Map());
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
    const audioRef = useRef<HTMLAudioElement>(null);
    const audioFileRef = useRef<File | null>(null);
    const clockOffsetRef = useRef<number>(0);

    const [roomId, setRoomId] = useState<string>('');
    const [hasJoined, setHasJoined] = useState<boolean>(false);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioURL, setAudioURL] = useState<string | null>(null);
    const [alertMessage, setAlertMessage] = useState<string>('');

    useEffect(() => {
        //flush the old track and load the new track when the url changes
        //needed for mobile
        if (audioRef.current && audioURL) {
            audioRef.current.load();
        }
    }, [audioURL])

    useEffect(() => {
        if (!alertMessage)
            return;

        const timer = setTimeout(() => { setAlertMessage('') }, 2000)

        const handleInteract = () => setAlertMessage('');

        document.addEventListener('mousedown', handleInteract, true);
        document.addEventListener('touchstart', handleInteract, true);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleInteract, true);
            document.removeEventListener('touchstart', handleInteract, true);
        }
    }, [alertMessage])

    const leaveRoom = () => {
        // Close all peer connections
        peersRef.current.forEach(pc => pc.close());
        peersRef.current.clear();
        fileChannelRef.current.clear();
        syncChannelRef.current.clear();
        pendingCandidatesRef.current.clear();

        // Reset UI and app state
        setRoomId('');
        setHasJoined(false);
        setAudioFile(null);
        setAudioURL(null);
        isHostRef.current = false;
        audioFileRef.current = null;

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }
    };

    const createRoom = async () => {
        isHostRef.current = true;

        // temporary bypass to get datachannel working
        // await navigator.mediaDevices.getUserMedia({ audio: true });

        const newRoomId = Math.random().toString(36).substring(2, 8);
        setRoomId(newRoomId);
        socketRef.current?.emit('join-room', newRoomId);
        console.log(`Created and joined room: ${newRoomId}`);
    };

    const joinRoom = async () => {
        isHostRef.current = false;

        if (roomId.trim() !== '') {
            socketRef.current?.emit('join-room', roomId, (response: { success: boolean, message?: string }) => {
                if (response.success) {
                    setHasJoined(true);

                    //mobile-autoplay hack
                    if (audioRef.current) {
                        audioRef.current.play().catch(e => console.log("Silent play triggered to unlock audio"))
                        audioRef.current.pause();
                    }

                    console.log(`Joined room: ${roomId}`);
                } else
                    setAlertMessage(response.message || 'Room not found!');
            });

        }
    }

    const broadcastCommand = (type: string, time: number, isPlaying?: boolean) => {
        peersRef.current.forEach((pc, guestId) => {
            const dc = syncChannelRef.current.get(guestId);
            if (dc && dc.readyState === 'open') {
                dc.send(JSON.stringify({
                    type,
                    time,
                    isPlaying: isPlaying === true,
                    timestamp: Date.now()
                }));

                // console.log('Command : '${{ type, time }} sent to ${guestId}`);
            }
        });
    }

    const sendFileToGuest = async (guestId: string, arrayBuffer: ArrayBuffer) => {

        const dc = fileChannelRef.current.get(guestId);
        if (!dc || dc.readyState !== 'open') return;

        const CHUNK_SIZE = 16384; // 16KB
        const MAX_BUFFER = 65535; //64KB 

        let offset: number = 0;

        const sendNextBatch = () => {
            while (offset < arrayBuffer.byteLength) {

                if (dc.bufferedAmount >= MAX_BUFFER)
                    break;

                const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
                dc.send(chunk);
                offset += CHUNK_SIZE;
            }

            if (offset >= arrayBuffer.byteLength) {
                dc.send("EOF");
                console.log("Audio file sent");
            }

        }

        dc.onbufferedamountlow = () => {
            if (offset < arrayBuffer.byteLength)
                sendNextBatch();
        }

        sendNextBatch();

    }

    const sendAudioFile = async (): Promise<void> => {
        if (!audioFile) {
            console.log("No audio file selected!");
            return;
        }

        generateAudioURLFile(audioFile);

        const arrayBuffer = await audioFile.arrayBuffer();
        peersRef.current.forEach((pc, guestId) => {
            sendFileToGuest(guestId, arrayBuffer);
        })
    }

    const generateAudioURLBuffer = (buffer: any[]): void => {

        const blob = new Blob(buffer, {
            type: 'audio/mpeg'
        });

        const url = URL.createObjectURL(blob);
        console.log('Generated audio URL: ', url);

        setAudioURL(url);
    }

    const generateAudioURLFile = (file: File): void => {

        const blob = new Blob([file], {
            type: 'audio/mpeg'
        });

        const url = URL.createObjectURL(blob);
        console.log('Generated audio URL: ', url);

        setAudioURL(url);
    }

    const createPeerConnection = (targetId: string): RTCPeerConnection => {

        // const username = import.meta.env.VITE_TURN_USERNAME;
        // const password = import.meta.env.VITE_TURN_PASSWORD;

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        });

        // pc.oniceconnectionstatechange = () => {
        //     console.log(`ICE Connection State for ${targetId}:`, pc.iceConnectionState);
        // }

        // pc.onconnectionstatechange = () => {
        //     console.log(`Global Connection State for ${targetId}:`, pc.connectionState);
        // }

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

            if (receiveChannel.label.startsWith('sync-channel')) {


                const sendPing = () => {
                    if (!isHostRef.current && receiveChannel.readyState === "open") {
                        receiveChannel.send(JSON.stringify({
                            type: "PING",
                            clientTime: Date.now()
                        }));

                        console.log("PING Sent")
                    }
                };

                let pingInterval: NodeJS.Timeout;
                receiveChannel.onopen = () => {
                    sendPing();
                    pingInterval = setInterval(sendPing, 1000);
                }


                receiveChannel.onmessage = (messageEvent) => {
                    const command = JSON.parse(messageEvent.data);

                    //Process PONG from host
                    if (command.type === "PONG") {

                        clearInterval(pingInterval);

                        const roundTripTime = Date.now() - command.clientTime;
                        const oneWayLatency = roundTripTime / 2;

                        //Host's clock time
                        const estimatedHostTime = command.serverTime + oneWayLatency;

                        //gap between local and host time
                        clockOffsetRef.current = estimatedHostTime - Date.now();
                        console.log(`Clock sync complete. Offset: ${clockOffsetRef.current}ms | Latency: ${oneWayLatency}ms`);
                        return;
                    }

                    if (!audioRef.current || audioRef.current.readyState === 0) return;

                    const syncDateNow = Date.now() + clockOffsetRef.current;
                    const delay = Math.max(0, (syncDateNow - command.timestamp) / 1000);
                    const targetTime = command.time + delay;

                    if (command.type === "SYNC") {

                        if (command.isPlaying && audioRef.current.paused) {

                            audioRef.current.currentTime = targetTime;
                            audioRef.current.play().catch(e => console.error("Autoplay blocked by browser:", e));

                        } else if (!command.isPlaying && !audioRef.current.paused) {

                            audioRef.current.pause();
                            audioRef.current.currentTime = targetTime;

                        } else if (command.isPlaying) {

                            const drift = targetTime - audioRef.current.currentTime;

                            //widen the gaps so that mobile doesnt stutter
                            if (Math.abs(drift) > 2.0) {
                                audioRef.current.currentTime = targetTime;
                                audioRef.current.playbackRate = 1.0;
                            } else if (drift > 0.1) {
                                audioRef.current.playbackRate = 1.02;
                            } else if (drift < -0.1) {
                                audioRef.current.playbackRate = 0.98;
                            } else if (Math.abs(drift) < 0.04) {

                                //only return to normal if we are locked in
                                if (audioRef.current.playbackRate !== 1.0)
                                    audioRef.current.playbackRate = 1.0;
                            }
                        }

                    } else {

                        // Explicit Commands (PLAY, PAUSE, SEEK)
                        audioRef.current.playbackRate = 1.0; // Reset speed safety
                        audioRef.current.currentTime = targetTime;

                        if (command.type === "PAUSE") {
                            audioRef.current.pause();
                        } else if (command.type === "PLAY") {
                            audioRef.current.play();
                        }
                    }


                    // console.log("Received data: ", messageEvent.data);   

                }
            } else if (receiveChannel.label.startsWith('file-channel')) {

                let receiveBuffer: any[] = [];
                receiveChannel.onmessage = (messageEvent) => {
                    if (messageEvent.data === 'EOF') {
                        generateAudioURLBuffer(receiveBuffer);
                        receiveBuffer = [];
                    } else {
                        receiveBuffer.push(messageEvent.data);
                    }
                }

            }
        }

        peersRef.current.set(targetId, pc);
        return pc;
    }

    const initiateHandshake = async (guestSocketId: string): Promise<void> => {
        if (!socketRef.current)
            return;

        const pc = createPeerConnection(guestSocketId);

        //create the file(reliable) and sync(unreliable) channels
        const fileChannel = pc.createDataChannel(`file-channel-${guestSocketId}`);

        fileChannel.onopen = async () => {
            console.log(`Data channel open with ${guestSocketId}`);
            if (audioFileRef.current != null) {
                const arrayBuffer = await audioFileRef.current.arrayBuffer();
                sendFileToGuest(guestSocketId, arrayBuffer);
            }
        };

        fileChannelRef.current.set(guestSocketId, fileChannel);

        const syncChannel = pc.createDataChannel(`sync-channel-${guestSocketId}`, {
            ordered: false,
            maxRetransmits: 0
        });

        syncChannel.onmessage = (messageEvent) => {
            if (typeof messageEvent.data === 'string' && messageEvent.data !== 'EOF') {
                const command = JSON.parse(messageEvent.data);

                if (command.type === "PING") {
                    syncChannel.send(JSON.stringify({
                        type: "PONG",
                        clientTime: command.clientTime,
                        serverTime: Date.now()
                    }));

                    console.log("PONG Sent")
                }
            }
        };

        syncChannelRef.current.set(guestSocketId, syncChannel);


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
        // socketRef.current = io('http://10.29.198.114:3000');
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

    useEffect(() => {
        const syncBroadcast = setInterval(() => {
            if (isHostRef.current && audioRef.current) {
                // console.log("Host is broadcasting SYNC...");

                broadcastCommand('SYNC',
                    audioRef.current.currentTime,
                    !audioRef.current.paused);
            }
        }, 2000);

        return () => clearInterval(syncBroadcast);
    }, []);

    const handleFileSelect = (file: File) => {
        setAudioFile(file);
        audioFileRef.current = file;
    };

    return (
        <div className='App-container'>
            <h1>SyncPlayer</h1>

            {(hasJoined || isHostRef.current) && (
                <button
                    onClick={leaveRoom}
                    style={{
                        marginBottom: '10px',
                        background: 'linear-gradient(#ffccd5 0%, #ff8099 48%, #ff4d6d 50%, #ff8099 100%)',
                        borderColor: '#cc0022',
                        color: '#4d000d'
                    }}
                >
                    ⬅ Disconnect & Go Back
                </button>
            )}

            {alertMessage && (
                <div className="win95-overlay">
                    <div className="win95-dialog">
                        <div className="win95-titlebar">
                            <span>Connection Error</span>
                            <div className="win95-close">X</div>
                        </div>
                        <div className="win95-content">
                            <div className="win95-icon">×</div>
                            <div>{alertMessage}</div>
                        </div>
                    </div>
                </div>
            )}

            {!hasJoined && (
                <HostControls
                    isHost={isHostRef.current}
                    roomId={roomId}
                    createRoom={createRoom}
                    onFileSelect={handleFileSelect}
                    sendAudioFile={sendAudioFile}
                />
            )}

            {!isHostRef.current && (
                <GuestControls
                    roomId={roomId}
                    setRoomId={setRoomId}
                    joinRoom={joinRoom}
                    hasJoined={hasJoined}
                />
            )}

            <SyncPlayer
                isHost={isHostRef.current}
                audioURL={audioURL}
                audioRef={audioRef}
                broadcastCommand={broadcastCommand}
            />
        </div>
    )
}

