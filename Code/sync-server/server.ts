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

io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join-room', (roomId: string, callback) => {

        //check if room exists
        const roomExists:boolean = io.sockets.adapter.rooms.has(roomId);

        if (callback && !roomExists) {
            callback({success: false, message: "Room not found"});
            return;
        }

        socket.join(roomId);
        socket.to(roomId).emit('peer-joined', socket.id);
        console.log(`Socket ${socket.id} joined room: ${roomId}`);
        if (callback)
            callback({success: true})
    })

    socket.on('signal', (payload: SignalPayload) => {
        io.to(payload.targetId).emit('signal', {
            senderId: socket.id,
            signalData: payload.signalData
        })
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    })
});

const port: number = 3000;
server.listen(port, '0.0.0.0', ()=> {
    console.log(`Listening at port ${port}`);
});

