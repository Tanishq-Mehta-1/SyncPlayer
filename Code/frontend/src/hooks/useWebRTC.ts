/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    ICE_SERVERS,
    PING_INTERVAL_MS,
    SIGNALING_URL,
    SYNC_BROADCAST_INTERVAL_MS,
} from '../config.ts';
import { createAudioURL } from '../utils/audio.ts';
import { sendFileOverChannel } from '../utils/fileTransfer.ts';
import { applyPlaybackCommand } from '../utils/playbackSync.ts';

export function useWebRTC(audioRef: RefObject<HTMLAudioElement | null>) {
    // ---- Refs (mutable, non-rendering state) ----
    const socketRef = useRef<Socket | null>(null);
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const fileChannelRef = useRef<Map<string, RTCDataChannel>>(new Map());
    const syncChannelRef = useRef<Map<string, RTCDataChannel>>(new Map());
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
    const isHostRef = useRef<boolean>(false);
    const audioFileRef = useRef<File | null>(null);
    const clockOffsetRef = useRef<number>(0);

    // ---- State (drives rendering) ----
    const [roomId, setRoomId] = useState<string>('');
    const [hasJoined, setHasJoined] = useState<boolean>(false);
    const [isHost, setIsHost] = useState<boolean>(false);
    const [audioURL, setAudioURL] = useState<string | null>(null);
    const [alertMessage, setAlertMessage] = useState<string>('');

    // ---- Room lifecycle ----
    const leaveRoom = () => {
        peersRef.current.forEach(pc => pc.close());
        peersRef.current.clear();
        fileChannelRef.current.clear();
        syncChannelRef.current.clear();
        pendingCandidatesRef.current.clear();

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
    };

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
    const broadcastCommand = (type: string, time: number, isPlaying?: boolean) => {
        peersRef.current.forEach((_pc, guestId) => {
            const dc = syncChannelRef.current.get(guestId);
            if (dc && dc.readyState === 'open') {
                dc.send(JSON.stringify({
                    type,
                    time,
                    isPlaying: isPlaying === true,
                    timestamp: Date.now(),
                }));
            }
        });
    };

    const handleFileSelect = (file: File) => {
        audioFileRef.current = file;
    };

    const sendAudioFile = async (): Promise<void> => {
        const file = audioFileRef.current;
        if (!file) {
            console.log('No audio file selected!');
            return;
        }

        setAudioURL(createAudioURL([file]));

        const arrayBuffer = await file.arrayBuffer();
        peersRef.current.forEach((_pc, guestId) => {
            sendFileOverChannel(fileChannelRef.current.get(guestId), arrayBuffer);
        });
    };

    // ---- Guest: receiving channels ----
    const setupSyncReceiver = (channel: RTCDataChannel) => {
        const sendPing = () => {
            if (!isHostRef.current && channel.readyState === 'open') {
                channel.send(JSON.stringify({ type: 'PING', clientTime: Date.now() }));
                console.log('PING Sent');
            }
        };

        let pingInterval: ReturnType<typeof setInterval>;
        channel.onopen = () => {
            sendPing();
            pingInterval = setInterval(sendPing, PING_INTERVAL_MS);
        };

        channel.onmessage = (messageEvent) => {
            const command = JSON.parse(messageEvent.data);

            // Process PONG from host
            if (command.type === 'PONG') {
                clearInterval(pingInterval);

                const oneWayLatency = (Date.now() - command.clientTime) / 2;
                const estimatedHostTime = command.serverTime + oneWayLatency;

                // gap between local and host time
                clockOffsetRef.current = estimatedHostTime - Date.now();
                console.log(`Clock sync complete. Offset: ${clockOffsetRef.current}ms | Latency: ${oneWayLatency}ms`);
                return;
            }

            if (audioRef.current) {
                applyPlaybackCommand(audioRef.current, command, clockOffsetRef.current);
            }
        };
    };

    const setupFileReceiver = (channel: RTCDataChannel) => {
        let receiveBuffer: any[] = [];
        channel.onmessage = (messageEvent) => {
            if (messageEvent.data === 'EOF') {
                setAudioURL(createAudioURL(receiveBuffer));
                receiveBuffer = [];
            } else {
                receiveBuffer.push(messageEvent.data);
            }
        };
    };

    // ---- Peer connection ----
    const createPeerConnection = (targetId: string): RTCPeerConnection => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onconnectionstatechange = () => {
            console.log(`Global Connection State for ${targetId}:`, pc.connectionState);

            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                if (!isHostRef.current) {
                    // host dropped the connection, we are guests
                    leaveRoom();
                    setAlertMessage('The host has closed the room');
                } else {
                    // guest closed the connection
                    peersRef.current.delete(targetId);
                    fileChannelRef.current.delete(targetId);
                    syncChannelRef.current.delete(targetId);
                    console.log(`Guest ${targetId} disconnected.`);
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
            if (channel.label.startsWith('sync-channel')) setupSyncReceiver(channel);
            else if (channel.label.startsWith('file-channel')) setupFileReceiver(channel);
        };

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
                console.log('Ice candidated added successfully');
            } catch (error) {
                console.error('Error adding queued ICE candidate', error);
            }
        }
        pendingCandidatesRef.current.set(peerId, []);
    };

    const initiateHandshake = async (guestSocketId: string): Promise<void> => {
        if (!socketRef.current) return;

        const pc = createPeerConnection(guestSocketId);

        // file channel (reliable)
        const fileChannel = pc.createDataChannel(`file-channel-${guestSocketId}`);
        fileChannel.onopen = async () => {
            console.log(`Data channel open with ${guestSocketId}`);
            if (audioFileRef.current != null) {
                const arrayBuffer = await audioFileRef.current.arrayBuffer();
                sendFileOverChannel(fileChannelRef.current.get(guestSocketId), arrayBuffer);
            }
        };
        fileChannelRef.current.set(guestSocketId, fileChannel);

        // sync channel (unreliable)
        const syncChannel = pc.createDataChannel(`sync-channel-${guestSocketId}`, {
            ordered: false,
            maxRetransmits: 0,
        });
        syncChannel.onmessage = (messageEvent) => {
            if (typeof messageEvent.data === 'string' && messageEvent.data !== 'EOF') {
                const command = JSON.parse(messageEvent.data);

                if (command.type === 'PING') {
                    syncChannel.send(JSON.stringify({
                        type: 'PONG',
                        clientTime: command.clientTime,
                        serverTime: Date.now(),
                    }));
                    console.log('PONG Sent');
                }
            }
        };
        syncChannelRef.current.set(guestSocketId, syncChannel);

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
                console.log('Ice candidated added successfully');
            } else {
                if (!pendingCandidatesRef.current.has(data.senderId)) {
                    pendingCandidatesRef.current.set(data.senderId, []);
                }
                pendingCandidatesRef.current.get(data.senderId)!.push(iceCandidate);
                console.log('Ice candidated queued');
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

        socket.on('signal', handleSignal);

        return () => {
            socket.disconnect();
            peersRef.current.forEach(pc => pc.close());
        };
        // only runs once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const syncBroadcast = setInterval(() => {
            if (isHostRef.current && audioRef.current) {
                broadcastCommand('SYNC', audioRef.current.currentTime, !audioRef.current.paused);
            }
        }, SYNC_BROADCAST_INTERVAL_MS);

        return () => clearInterval(syncBroadcast);
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
        sendAudioFile,
        broadcastCommand,
    };
}
