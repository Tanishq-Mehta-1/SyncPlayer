import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';

interface SignalData {
    type: 'offer' | 'answer' | 'ice-candidate';
    sdp?: any;
    candidate?: any;
}

interface SignalPayload {
    targetId: string;
    signalData: SignalData;
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const socketMap = new Map<string, string>();

io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join-room', (roomId: string, callback) => {

        //check if room exists
        const roomExists: boolean = io.sockets.adapter.rooms.has(roomId);

        if (callback && !roomExists) {
            callback({ success: false, message: "Room not found" });
            return;
        }

        socketMap.set(socket.id, roomId);

        socket.join(roomId);
        socket.to(roomId).emit('peer-joined', socket.id);
        console.log(`Socket ${socket.id} joined room: ${roomId}`);
        if (callback)
            callback({ success: true })
    })

    socket.on('leave-room', (roomId: string) => {

        if (roomId !== socketMap.get(socket.id)) {
            console.log("ERROR::Socket-Room mismatch")
            return;
        }

        socket.leave(roomId);
        socket.to(roomId).emit('peer-left', socket.id);
        socketMap.delete(socket.id);
        console.log(`Socket ${socket.id} left room: ${roomId}`);
    })

    socket.on('signal', (payload: SignalPayload) => {
        io.to(payload.targetId).emit('signal', {
            senderId: socket.id,
            signalData: payload.signalData
        })
    });


    socket.on('disconnect', () => {

        const roomId = socketMap.get(socket.id);

        if (typeof(roomId) === 'string') {
            socket.leave(roomId);
            socket.to(roomId).emit('peer-left', socket.id);
            socketMap.delete(socket.id);
            console.log(`Socket ${socket.id} left room: ${roomId}`);
        }

        console.log(`User disconnected: ${socket.id}`);
    })
});

const port: number = 3000;
server.listen(port, '0.0.0.0', () => {
    console.log(`Listening at port ${port}`);
});

