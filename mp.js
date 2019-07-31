//var ws = new WebSocket("ws://localhost:3000"); //"ws://10.150.93.108:8080");
var ws = new WebSocket("ws://ws.bridgega.me:3001");

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

ws.onmessage = function (event) {
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
                    pal.state = p.state;
                });

                for(id in otherPlayers)
                {
                    otherPlayers[id].alive = data.some((p2) => p2.id == id);
                }
            }
            break;
    }
};

setInterval(() => {
    if(state == 'Playing') {
        send({});
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