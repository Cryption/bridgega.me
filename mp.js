//var ws = new WebSocket("ws://localhost:3000"); //"ws://10.150.93.108:8080");
var ws = new WebSocket("wss://ws.bridgega.me");

var tokensEl = document.getElementById('tokens');
var statusEl = document.getElementById('status');
var state = 'Connecting';

var tokens = 5;

function send(json) {
    if(json.type != 'spawn') {
        json.x = me.pos.x;
        json.y = me.pos.y;
        json.state = me.state;
    }

    ws.send(JSON.stringify(json));
}

ws.onclose = () => {
    statusEl.innerText = 'Disconnected';
    state = 'Closed';
};

ws.onopen = (e) => {
    statusEl.innerText = "Connected";
    state = 'Dead';
};

let otherPlayers = {};


const stateValues = [
    "idle", "walk", "jump",
    "fall", "bonker", "bonk",
    "down", "ko"
];

ws.binaryType = 'arraybuffer';
ws.onmessage = function (event) {
    if(event.data instanceof ArrayBuffer) {
        var buf = new Uint8Array(event.data).buffer;
        var dv = new DataView(buf);

        let savedIds = [];

        for(let i = 0; i < dv.byteLength; i += (4 * 3) + 1)
        {
            let id = dv.getInt32(i, true);
            let x = dv.getFloat32(i + 4, true);
            let y = dv.getFloat32(i + 8, true);
            let state = dv.getUint8(i + (4 * 3));

            if(window.me != null && id == me.id) continue;
            if(otherPlayers[id] == null)
                otherPlayers[id] = spawnFriend();

            let pal = otherPlayers[id];
            pal.id = id;
            
            pal.oldPos = pal.newPos;
            pal.newPos = { x: x, y: y };
            pal.oldTime = pal.newTime;
            pal.newTime = Date.now();
            pal.state = stateValues[state];

            savedIds.push(id);
        }

        for(id in otherPlayers)
        {
            otherPlayers[id].alive = savedIds.indexOf(otherPlayers[id].id) != -1;
        }
    } else {
        let data = JSON.parse(event.data);
        if(data.type != null)
            console.log(data);

        if(data.bridgeOn != null) {
            window.bridgeOn = data.bridgeOn;
        }

        switch(data.type) {
            case "spawned":
                state = 'Playing';
                spawnPlayer(data.pos);
                me.id = data.id;
                break;
            case "die":
                state = 'Dead';
                me.alive = false;
                me = null;
                break;
            case "cheat":
                me.vel = { x: 0, y: 0};
                me.pos = { x: data.x, y: data.y };
                break;
            case "hit":
                me.hit(data.ko);
                break;
            case "bonkBridge":
                window.bonkBridge(data.invert);
                break;
            case "bonkWin":
                window.bonkWin();
                break;
            case undefined:
                if(Array.isArray(data)) {
                    data.forEach((p) => {
                        if(window.me != null && p.id == me.id) return;
                        if(otherPlayers[p.id] == null)
                            otherPlayers[p.id] = spawnFriend();

                        let pal = otherPlayers[p.id];
                        pal.id = p.id;
                        
                        pal.oldPos = pal.newPos;
                        pal.newPos = { x: p.x, y: p.y };
                        pal.oldTime = pal.newTime;
                        pal.newTime = Date.now();
                        pal.state = stateValues[p.state];
                    });

                    for(id in otherPlayers)
                    {
                        otherPlayers[id].alive = data.some((p2) => p2.id == id);
                    }
                }
                break;
        }
    }
};

setInterval(() => {
    if(state == 'Playing') {
        let buf = new ArrayBuffer((4 * 2) + 1);
        let dv = new DataView(buf);

        dv.setFloat32(0, me.pos.x, true);
        dv.setFloat32(4, me.pos.y, true);
        dv.setUint8(8, Math.max(0, stateValues.indexOf(me.state)));

        ws.send(dv);
    }

    tokensEl.innerText = tokens + ' lives';
}, 50);

function start() {
    if(state != 'Dead' || tokens <= 0) return;
    state = 'Spawning';
    tokens--;
    console.log('spawn');

    send({
        type: 'spawn'
    });

    /*if(window.me != null) {
        me.pos = { x: 3, y: 8 };
        me.vel = { x: 0, y: 0 };
    }*/
}

mp = {};

mp.hit = function(other, ko) {
    send({ 
        type: 'hitPlayer',
        collision: {
            p2: other.id
        },
        ko: ko
    });
}

mp.bonkBridge = function(invert) {
    send({
        type: 'hitButton',
        invert: invert
    });
}

mp.bonkWin = function(invert) {
    send({
        type: 'hitWin'
    });
}