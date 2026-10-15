/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    ICE_SERVERS,
    SIGNALING_URL,
} from '../config.ts';
import { createAudioURL } from '../utils/audio.ts';

export function useWebRTC(audioRef: RefObject<HTMLAudioElement | null>) {
    // ---- Refs (mutable, non-rendering state) ----
    const socketRef = useRef<Socket | null>(null);
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const syncChannelRef = useRef<Map<string, RTCDataChannel>>(new Map());
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
    const isHostRef = useRef<boolean>(false);
    const audioFileRef = useRef<File | null>(null);
    const liveStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    // ---- State (drives rendering) ----
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [songTitle, setSongTitle] = useState<string | null>(null);
    const [roomId, setRoomId] = useState<string>('');
    const [hasJoined, setHasJoined] = useState<boolean>(false);
    const [isHost, setIsHost] = useState<boolean>(false);
    const [audioURL, setAudioURL] = useState<string | null>(null);
    const [alertMessage, setAlertMessage] = useState<string>('');
    const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting'>('idle');

    // ---- Room lifecycle ----
    const leaveRoom = useCallback(() => {
        peersRef.current.forEach(pc => pc.close());
        peersRef.current.clear();
        syncChannelRef.current.clear();
        pendingCandidatesRef.current.clear();

        if (roomId) {
            socketRef.current?.emit('leave-room', roomId);
        }

        setRoomId('');
        setHasJoined(false);
        setIsHost(false);
        setAudioURL(null);
        isHostRef.current = false;
        audioFileRef.current = null;

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }


    }, [roomId, audioRef]);

    useEffect(() => {

        const handleUnload = () => leaveRoom();
        window.addEventListener('beforeunload', handleUnload)
        return () => window.removeEventListener('beforeunload', handleUnload);

    }, [leaveRoom])

    useEffect(() => {
        if (isHostRef.current) {
            if (!audioContextRef.current && audioRef.current) {
                //intialise audio context for browser
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                audioContextRef.current = new AudioContextClass();

                //node that outputs the WebRTC MediaStream
                const destNode = audioContextRef.current.createMediaStreamDestination()
                liveStreamRef.current = destNode.stream;

                //route the <audio> element as source
                const sourceNode = audioContextRef.current.createMediaElementSource(audioRef.current);

                //send audio to WebRTC node
                sourceNode.connect(destNode);
                //send audio to system's speakers
                sourceNode.connect(audioContextRef.current.destination);

                console.log(`MediaStream setup`)
            }
        }
    }, [audioRef, isHost])

    const createRoom = async () => {
        isHostRef.current = true;
        setIsHost(true);

        const newRoomId = Math.random().toString(36).substring(2, 8);
        setRoomId(newRoomId);
        socketRef.current?.emit('join-room', newRoomId);
        console.log(`Created and joined room: ${newRoomId}`);
    };

    const joinRoom = async () => {
        isHostRef.current = false;
        setIsHost(false);

        if (roomId.trim() === '') return;

        socketRef.current?.emit('join-room', roomId, (response: { success: boolean; message?: string }) => {
            if (response.success) {
                setHasJoined(true);

                // mobile-autoplay hack
                if (audioRef.current) {
                    audioRef.current.play().catch(() => console.log('Silent play triggered to unlock audio'));
                    audioRef.current.pause();
                }

                console.log(`Joined room: ${roomId}`);
            } else {
                setAlertMessage(response.message || 'Room not found!');
            }
        });
    };

    // ---- Host: broadcasting & file sending ----
    // const broadcastCommand = (type: string, time: number, isPlaying?: boolean) => {
    //     peersRef.current.forEach((_pc, guestId) => {
    //         const dc = syncChannelRef.current.get(guestId);
    //         // console.log(`Guest ${guestId}'s data channel: ${dc?.readyState}`);
    //         if (dc && dc.readyState === 'open') {
    //             dc.send(JSON.stringify({
    //                 type,
    //                 time,
    //                 isPlaying: isPlaying === true,
    //                 timestamp: Date.now(),
    //             }));
    //         }
    //     });
    // };

        const broadcastCommand = (type: string, time?: number, title?: string) => {
        peersRef.current.forEach((_pc, guestId) => {
            const dc = syncChannelRef.current.get(guestId);
            if (dc && dc.readyState === 'open') {
                console.log(`Status of ${guestId} data channel: ${dc.readyState}`)
                dc.send(JSON.stringify({
                    type,
                    time,
                    title,
                }));
            }
        });
    };

    const handleFileSelect = (file: File) => {
        audioFileRef.current = file;

        setAudioURL(createAudioURL([file]))
    };

    // ---- Peer connection ----
    const createPeerConnection = (targetId: string): RTCPeerConnection => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onconnectionstatechange = () => {
            // console.log(`Global Connection State for ${targetId}:`, pc.connectionState);

            if (pc.connectionState === 'disconnected' && !isHostRef.current) {
                console.log('Connection lost. Attempting to recover');
                setConnectionState('reconnecting');
            } else if (pc.connectionState === 'connected') {
                console.log(`Connected to ${targetId}!`);
                setConnectionState('connected')
            } else if (pc.connectionState === 'failed') {
                //permanent connection drop
                if (!isHostRef.current) {
                    // host dropped the connection, we are guests
                    leaveRoom();
                    setAlertMessage('The host has closed the room');
                } else {
                    // guest closed the connection
                    peersRef.current.delete(targetId);
                    syncChannelRef.current.delete(targetId);
                }
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Found ICE candidate:', event.candidate);
                socketRef.current?.emit('signal', {
                    targetId,
                    signalData: { type: 'ice-candidate', candidate: event.candidate.toJSON() },
                });
            }
        };

        pc.ondatachannel = (event) => {
            const channel = event.channel;  

            channel.onmessage = (e) => {
                const command = JSON.parse(e.data);

                switch (command.type) {
                    case 'PLAY':
                        setIsPlaying(true);
                        break;
                    case 'PAUSE':
                        setIsPlaying(false);
                        break;
                    case 'SEEK':
                        setProgress(command.currentTime);
                        break;
                    case 'TRACK_CHANGE':
                        setSongTitle(command.title);    
                        break;
                }
            }
        };

        if (!isHostRef.current) {
            pc.ontrack = (event) => {
                //incoming stream container from host
                const incomingStream = event.streams[0];

                if (audioRef.current) {
                    audioRef.current.srcObject = incomingStream;

                    //simulated user interaction so that the player plays on joining 
                    audioRef.current.play().catch(e => console.error("Playback failed: ", e));
                }

                console.log(`Caught media stream from host [${targetId}] : ${incomingStream}`)
            }
        }

        peersRef.current.set(targetId, pc);
        return pc;
    };

    // ---- Signaling ----
    const flushPendingCandidates = async (pc: RTCPeerConnection, peerId: string) => {
        const queued = pendingCandidatesRef.current.get(peerId);
        if (!queued) return;

        for (const candidate of queued) {
            try {
                await pc.addIceCandidate(candidate);
                console.log('Ice candidate added successfully');
            } catch (error) {
                console.error('Error adding queued ICE candidate', error);
            }
        }
        pendingCandidatesRef.current.set(peerId, []);
    };

    const initiateHandshake = async (guestSocketId: string): Promise<void> => {
        if (!socketRef.current) return;

        const pc = createPeerConnection(guestSocketId);

        // sync channel (unreliable)
        const syncChannel = pc.createDataChannel(`sync-channel-${guestSocketId}`, {
            ordered: false,
            maxRetransmits: 0,
        });
        syncChannelRef.current.set(guestSocketId, syncChannel);

        //attach the media track to the PC
        const track = liveStreamRef.current?.getAudioTracks()[0];
        if (track && liveStreamRef.current)
            pc.addTrack(track, liveStreamRef.current);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socketRef.current.emit('signal', {
            targetId: guestSocketId,
            signalData: { type: 'offer', sdp: offer },
        });
        console.log('Sent SDP Offer to Guest');
    };

    const handleSignal = async (data: { senderId: string; signalData: any }) => {
        const { type, sdp } = data.signalData;

        if (type === 'offer') {
            const pc = createPeerConnection(data.senderId);

            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socketRef.current?.emit('signal', {
                targetId: data.senderId,
                signalData: { type: 'answer', sdp: answer },
            });
            console.log('Guest: Received Offer, send Answer back');

            await flushPendingCandidates(pc, data.senderId);
        } else if (type === 'answer') {
            const pc = peersRef.current.get(data.senderId);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                console.log('Host: Received Answer, handshake complete');

                await flushPendingCandidates(pc, data.senderId);
            }
        } else if (type === 'ice-candidate') {
            const pc = peersRef.current.get(data.senderId);
            if (!pc) return;

            const iceCandidate = new RTCIceCandidate(data.signalData.candidate);
            console.log(`Received ICE Candidate from ${data.senderId}`);

            if (pc.remoteDescription) {
                await pc.addIceCandidate(iceCandidate);
                console.log('Ice candidate added successfully');
            } else {
                if (!pendingCandidatesRef.current.has(data.senderId)) {
                    pendingCandidatesRef.current.set(data.senderId, []);
                }
                pendingCandidatesRef.current.get(data.senderId)!.push(iceCandidate);
                console.log('Ice candidate queued');
            }
        }
    };

    // ---- Effects ----
    useEffect(() => {
        const socket = io(SIGNALING_URL);
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to signaling server! My ID:', socket.id);
        });

        socket.on('peer-joined', (guestSocketId: string) => {
            if (isHostRef.current) {
                console.log(`A guest joined with ID: ${guestSocketId}`);
                initiateHandshake(guestSocketId);
            }
        });

        socket.on('peer-left', (guestSocketId: string) => {
            console.log(`guest ${guestSocketId} has left the room`);
        });

        socket.on('signal', handleSignal);

        return () => {
            socket.disconnect();
            peersRef.current.forEach(pc => pc.close());
        };
        // only runs once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        roomId,
        setRoomId,
        hasJoined,
        audioURL,
        alertMessage,
        setAlertMessage,
        isHost,
        createRoom,
        joinRoom,
        leaveRoom,
        handleFileSelect,
        broadcastCommand,
        connectionState
    };
}
