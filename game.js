const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const level = [
    "?????????????????????????",
    "       ??????????????    ",
    "       ??????????????    ",
    "       ??????????????    ",
    "       ??????????????    ",
    "       ??????????????    ",
    "       ??????????????    ",
    "      #??????????????  $ ",
    "   @                     ",
    "                         ",
    "QWWWWWE!!!!!!!!!!!!!!QWWE",
    "ASSSSSD              ASSD"
];

let tiles = [];
let entities = {};

const playerStates = {
    idle: [400, "idle0", "idle1"],
    walk: [60, "walk0", "walk1", "walk0", "walk1", "walk2", "walk3", "walk2", "walk3"],
    jump: [1, "jump"],
    fall: [30, "fall0", "fall1"],
    bonker: [1, "bonker"],
    bonk: [1, "bonk"],
    down: [1, "down"],
    ko: [1, "ko"]
};

const width = canvas.width;
const height = canvas.height;

const levelWidth = level[0].length;
const levelHeight = level.length;

const gravity = 20;

window.onkeydown = function(e) { 
    if([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
    }
}

let players = [];

function lerp(value1, value2, amount) {
    amount = amount < 0 ? 0 : amount;
    amount = amount > 1 ? 1 : amount;
    return value1 + (value2 - value1) * amount;
}

function clamp(num, min, max) {
    return num <= min ? min : num >= max ? max : num;
}

class Player {
    constructor(controllable) {
        this.pos = { x: 0, y: 0 };
        this.vel = { x: 0, y: 0 };

        // multiplayer stuff
        this.oldTime = Date.now();
        this.newTime = Date.now();
        this.oldPos = { x: 0, y: 0 };
        this.newPos = { x: 0, y: 0 };

        /* 
            mp.input(uint8)
            up, left, down, right
            0123 WASD down
            4567 WASD up
        */

        if(controllable) {        
            window.addEventListener('keydown', (e) => {
                let delay = (window.delay || 0) + Math.max(0, window.fakeDelay || 0);
                setTimeout(() => {
                    if([65, 37].indexOf(e.keyCode) != -1) {
                        //this.left = true;
                        mp.input(1);
                    }
                    if([68, 39].indexOf(e.keyCode) != -1) {
                        //this.right = true;
                        mp.input(3);
                    }
                    if([87, 38, 32].indexOf(e.keyCode) != -1) {
                        //this.up = true;
                        mp.input(0);
                    }
                    if([83, 40].indexOf(e.keyCode) != -1) {
                        //this.down = true;
                        mp.input(2);
                    }
                }, delay);
            });

            window.addEventListener('keyup', (e) => {
                let delay = (window.delay || 0) + Math.max(0, window.fakeDelay || 0);
                setTimeout(() => {
                    if([65, 37].indexOf(e.keyCode) != -1) {
                        //this.left = false;
                        mp.input(5);
                    }
                    if([68, 39].indexOf(e.keyCode) != -1) {
                        //this.right = false;
                        mp.input(7);
                    }
                    if([87, 38, 32].indexOf(e.keyCode) != -1) {
                        //this.up = false;
                        mp.input(4);
                    }
                    if([83, 40].indexOf(e.keyCode) != -1) {
                        //this.down = false;
                        mp.input(6);
                    }
                }, delay);
            });
        }
        

        //this.controllable = false;

        this.lookingRight = true;

        this.stateTime = Date.now();

        this.alive = true;

        /** input **/
        this.left = false;
        this.right = false;
        this.up = false;
        this.down = false;
    }

    testCollision(ox, oy) {
        let x = parseInt(this.pos.x + ox);
        let y = parseInt(this.pos.y + oy);

        if(x >= 0 && x < levelWidth && y >= 0 && y < levelHeight) {
            let tile = level[y][x];
            if(tile != ' ' && tile != '@') {
                return true;
            }
        }

        return false;
    }

    capVelocity(x, y) { 
        /*
        //TODO: cap X and Y seperately, and cap different Y+ and Y- seperately too
        let magnitude = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
        if(magnitude > speed) {
            this.vel.x = this.vel.x / magnitude * speed;
            this.vel.y = this.vel.y / magnitude * speed;
        }
        */

       this.vel.x = clamp(this.vel.x, -x, x);
       this.vel.y = clamp(this.vel.y, -y, y);
    }

    handleInput(dt) {
        if(this.state == "bonker" || this.state == "ko") return;

        const speed = (this.state == 'bonk' && this.onGround) ? 10 : 50;
        const jumpForce = 12;

        if(this.left) {
            this.vel.x -= speed * dt;
            this.lookingRight = false;
            if(this.state == 'idle')
                this.state = 'walk';
        }
        
        if(this.right) {
            this.vel.x += speed * dt;
            this.lookingRight = true;
            if(this.state == 'idle')
                this.state = 'walk';
        }

        if(this.onGround && this.up) {
            this.vel.y = -jumpForce;
        }

        if(!this.onGround && this.state != 'bonk') {
            if(this.vel.y > 0 && this.down) {
                this.state = "bonker";
            } else this.state = this.vel.y > 0 ? 'fall' : 'jump';
        }

        if(this.state == 'idle' && this.down) {
            this.state = 'down';
        }
    }

    hit(ko) {
        if(ko) {
            this.state = "ko";
            this.stateTime = Date.now() + 2500;

            this.vel.x = (Math.random() * 1) * (Math.random() > 0.5 || this.pos.x > 7 ? -1 : 1);
        } else {

            this.state = "ko";
            this.stateTime = Date.now() + 400;

            this.vel.x = 2 + (Math.random() * 4) * (Math.random() > 0.5 || this.pos.x > 7 ? -1 : 1);

            /*
            this.state = "bonk";
            this.stateTime = Date.now() + 400;

            this.vel.x = 6 * (Math.random() > 0.5 || this.pos.x > 7 ? -1 : 1);
            */
        }
    }

    update(dt) {
        if(!this.alive) return;
        //if(this.controllable) {
            if(this.state == "ko") {
                if(Date.now() > this.stateTime) {
                    this.state = "bonk";
                    this.stateTime = Date.now() + 400;
                }
            } else if((this.state != "bonk" || Date.now() > this.stateTime) && this.state != "bonker")
                this.state = "idle";
        //}

        this.onGround = false;

        /*if(!this.controllable) {
            let delta = (Date.now() - this.newTime) / (this.newTime - this.oldTime);
            this.pos.x = lerp(this.oldPos.x, this.newPos.x, delta);
            this.pos.y = lerp(this.oldPos.y, this.newPos.y, delta);
            this.lookingRight = this.pos.x > this.oldPos.x;
            return;
        }*/

        if(this.state == "bonker") {
            this.vel.x -= this.vel.x * 4 * dt;
            this.vel.y += gravity * dt * 3;
        } else this.vel.y += gravity * dt;

        //console.log(this.pos.x);

        if(this.vel.y > 0) {
            players.forEach(player => {
                if(player != this
                    && parseInt(this.pos.y + 1 + (this.vel.y * dt)) == parseInt(player.pos.y)
                    && this.pos.x >= player.pos.x - .8 && this.pos.x < player.pos.x + .8 //parseInt(this.pos.x + 0.5) == parseInt(player.pos.x + 0.5)
                    && player.state != 'bonk' && player.state != 'ko') {
                    
                    mp.hit(player, this.state == "bonker");
                    
                    if(this.state == "bonker") {
                        this.state = "ko";
                        this.stateTime = Date.now() + (Math.random() * 300);

                        player.state = "ko";
                        player.stateTime = Date.now() + 500;

                        this.vel.x -= (Math.random() * Math.random() * 100);
                        this.vel.y = -2;

                        player.vel.x = (Math.random() * 12) * (Math.random() > 0.5 || player.pos.x > 7 ? -1 : 1);
                    } else {
                        player.state = "bonk";
                        player.stateTime = Date.now() + 400;

                        this.vel.x -= 2;
                        this.vel.y = -2;
    
                        player.vel.x = 6 * (Math.random() > 0.5 || player.pos.x > 7 ? -1 : 1);
                    }
                }
            });
        }

        if(this.vel.y > 0 && this.pos.x > -0.8 && this.testCollision(0.5, 1 + (this.vel.y * dt))) { //on ground
            let collidable = true;
            //console.log(this.pos.x);
            let hitX = parseInt(this.pos.x + 0.5);
            let hitY = parseInt(this.pos.y + 1 + (this.vel.y * dt));
            let hit = entities[`${hitX}:${hitY}`];
            if(hit != null && hit.collidable != null)
                collidable = hit.collidable;
            if(hit != null && hit.topCollidable != null) {
                collidable = hit.topCollidable;
            }
            if(hit != null && hit.fall)
                hit.fall();
            if(hit != null && hit.topbonk && this.state == "bonker")
                hit.topbonk();
            
            if(collidable && this.pos.y >= 6 && this.pos.y <= 9) {
                if(this.state == "bonker" && this.vel.y > 8) {
                    this.stateTime = Date.now() + 1000;
                    this.state = "ko";
                } else if(this.vel.y > 1) {
                        this.stateTime = Date.now() + 100;
                        this.state = "bonk";
                }

                this.vel.y = 0;
                if(this.state != "bonk" && this.state != "ko")
                    this.vel.x -= this.vel.x * 6 * dt;
                this.pos.y = clamp(Math.round(this.pos.y), 6, 9);

                this.onGround = true;
            }
        }

        this.handleInput(dt);

        //if(this.state == "ko") {
            let push = 0;
            players.forEach((player) => {
                if(player != this && player.state == 'idle') {
                    if(this.pos.x >= player.pos.x - .8 && this.pos.x < player.pos.x + .8
                        && this.pos.y >= player.pos.y - .8 && this.pos.y < player.pos.y + .8) {
                        if((player.lookingRight && this.pos.x >= player.pos.x) || (!player.lookingRight && this.pos.x <= player.pos.x))
                            push += 30 * (player.lookingRight ? 1 : -1);
                    }
                }
            });

            push = clamp(push, -30, 30);
            if(push != 0)
                this.vel.x -= this.vel.x * 20 * dt;
            this.vel.x += push * dt;
        //}

        this.capVelocity(this.state == "ko" ? 12 : 6, this.state == "bonker" ? 24 : 12);

        if(this.vel.y < 0 && this.testCollision(0.5, this.vel.y * dt - 0.3)) { //hit bottom of block
            this.stateTime = Date.now() + 300;
            this.state = "bonk";

            let hitX = parseInt(this.pos.x + 0.5);
            let hitY = parseInt(this.pos.y + (this.vel.y * dt - 0.3));

            this.vel.y = 0;
            this.pos.y = Math.round(this.pos.y) - 0.3;

            let hit = entities[`${hitX}:${hitY}`];
            if(hit != null && hit.bonk != null)
                hit.bonk();
        }

        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;

        console.log(this.pos);
    }

    draw(dt) {
        if(!this.alive) return;

        let frames = playerStates[this.state];
        if(frames == null) frames = playerStates['ko'];
        
        let frame = parseInt(((Date.now() / frames[0]) % (frames.length - 1)) + 1);
        let sprite = getTile(frames[frame]);

        let pos = offset(this.pos);

        ctx.save();
        ctx.translate(pos.x + 16, pos.y + 16);
        if(!this.lookingRight)
            ctx.scale(-1, 1);
        if(!this.controllable)
            ctx.globalAlpha = 0.65;

        ctx.drawImage(sprite, -16, -16, 32, 32);

        ctx.restore();
    }
}

function getTile(tile) {
    if(tiles[tile] != null)
        return tiles[tile];
    let t = document.getElementById(tile);
    tiles[tile] = t;
    return t;
}

function offset(pos) {
    let ox = width / 2 - levelWidth * 16;
    let oy = height - levelHeight * 32;

    return { x: ox + pos.x * 32, y: oy + pos.y * 32 };
}

function setupLevel() {
    for(let y = 0; y < levelHeight; y++) {
        for(let x = 0; x < levelWidth; x++) {
            if(tiles[level[y][x]] != null && tiles[level[y][x]].prototype != null)
                entities[`${x}:${y}`] = new tiles[level[y][x]]({ x: x, y: y });
        }
    }
}

tiles['@'] = class {
    constructor(pos) {
        /*window.spawnPlayer = function(p) {
            var player = new Player();
            player.pos = { x: pos.x, y: pos.y };
            player.controllable = true;

            players.push(player);
        }*/
    }
};

window.spawnPlayer = function(pos) {
    var player = new Player(true);
    player.pos = pos;

    window.me = player;

    players.push(player);
}

window.spawnFriend = function() {
    var player = new Player(false);

    players.push(player);

    return player;
}

window.bridgeOn = true;

tiles['!'] = class {
    constructor(pos) {
        this.pos = offset(pos);
        this.collidable = true;
    }

    update() {
        this.collidable = bridgeOn;
    }

    draw() {
        let tile = getTile(bridgeOn ? 'R' : 'T');
        ctx.drawImage(tile, this.pos.x, this.pos.y, 32, 32);
    }
}

tiles['#'] = class {
    constructor(pos) {
        this.pos = pos;

        this.state = 'idle';
        this.stateTime = Date.now();

        this.invert = false;
        this.sprite = getTile('O');

        window.bonkBridge = (invert) => {
            this.invert = invert;

            if(this.state == 'idle') {
                this.state = 'up';
                this.stateTime = Date.now();
            }
        };
    }

    update() {
        let pos = offset(this.pos);
        let now = Date.now();
        let oy = this.state == 'idle' ? 0 : (now - this.stateTime) / 5.0;

        if(this.state == 'up') {
            oy *= -1;
            if(oy <= -8) {
                this.state = 'down';
                this.stateTime = now;
            }
        } else if(this.state == 'down') {
            oy -= 8;
            if(oy >= 0) {
                this.state = 'idle';
            }
        }
    }

    draw() {
        let pos = offset(this.pos);
        let now = Date.now();
        let oy = this.state == 'idle' ? 0 : (now - this.stateTime) / 5.0;

        if(this.state == 'up') {
            oy *= -1;
            if(oy <= -8) {
                oy = -8;
            }
        } else if(this.state == 'down') {
            oy -= 8;
            if(oy >= 0) {
                oy = 0;
            }
        }

        if(this.invert) oy *= -1;

        ctx.drawImage(getTile(window.bridgeOn ? 'O' : 'P'), pos.x, pos.y + oy, 32, 32);
    }

    topbonk() {
        if(this.state != 'idle') return;
        this.state = 'up';
        this.stateTime = Date.now();

        mp.bonkBridge(true);

        //this.invert = true;
    }

    bonk() {
        if(this.state != 'idle') return;
        this.state = 'up';
        this.stateTime = Date.now();

        mp.bonkBridge(false);

        //this.invert = false;
    }
};

class Coin {
    constructor(pos) {
        this.pos = pos;
        this.vel = { x: Math.random() * 10.0 - 7.0, y: -15 };
        this.sprite = getTile('coin');
    }

    draw(dt) {
        this.vel.y += gravity * dt;

        //if(this.vel.y < 0)
            this.pos.y += this.vel.y * dt;
            this.pos.x += this.vel.x * dt;

        let pos = offset(this.pos);
        ctx.drawImage(this.sprite, pos.x, pos.y, 32, 32);
    }
}

tiles['$'] = class {
    constructor(pos) {
        this.pos = pos;

        this.state = 'idle';
        this.stateTime = Date.now();

        this.sprite = getTile('M');
        this.coins = [];

        window.bonkWin = () => {
            for(let i = 0; i < 15; i++) {
                let coin = new Coin({ x: this.pos.x, y: this.pos.y - 0.7 });
    
                setTimeout(() => 
                    this.coins.push(coin)
                , 100 * i);
    
                setTimeout(() =>
                    this.coins = this.coins.filter(item => item !== coin)
                , 100 * i + 1000);
            }

            if(this.state != 'idle') return;
            this.state = 'up';
            this.stateTime = Date.now();
        };
    }

    update(dt) {
        let pos = offset(this.pos);
        let now = Date.now();
        let oy = this.state == 'idle' ? 0 : (now - this.stateTime) / 5.0;

        if(this.state == 'up') {
            oy *= -1;
            if(oy <= -8) {
                this.state = 'down';
                this.stateTime = now;
            }
        } else if(this.state == 'down') {
            oy -= 8;
            if(oy >= 0) {
                this.state = 'idle';
            }
        }
    }

    draw(dt) {
        let pos = offset(this.pos);
        let now = Date.now();
        let oy = this.state == 'idle' ? 0 : (now - this.stateTime) / 5.0;

        if(this.state == 'up') {
            oy *= -1;
            if(oy <= -8) {
                oy = -8;
            }
        } else if(this.state == 'down') {
            oy -= 8;
            if(oy >= 0) {
                oy = 0;
            }
        }

        this.coins.forEach((c) => c.draw(dt));

        ctx.drawImage(this.sprite, pos.x, pos.y + oy, 32, 32);
    }

    bonk() {
        if(this.state != 'idle') return;
        this.state = 'up';
        this.stateTime = Date.now();

        mp.bonkWin();
    }
};

tiles['?'] = class {
    constructor(pos) {
        this.pos = pos;

        this.state = 'idle';
        this.stateTime = Date.now();

        this.on = false;
        this.sprite = getTile('Z');

        this.topCollidable = false;
    }

    draw(dt) {
        let pos = offset(this.pos);
        let now = Date.now();
        let oy = this.state == 'idle' ? 0 : (now - this.stateTime) / 5.0;

        if(this.state == 'up') {
            oy *= -1;
            if(oy <= -8) {
                oy = -8;
            }
        } else if(this.state == 'down') {
            oy -= 8;
            if(oy >= 0) {
                oy = 0;
            }
        }
        
        if(this.state == 'flip') {
            let frame = ((now - this.stateTime) / 50.0) + 1;
            if(frame >= 4) {
                oy = 0;
            } else {
                ctx.drawImage(getTile('Z' + parseInt(frame)), pos.x, pos.y, 32, 32);
            }
        }

        if(this.on && this.state != 'flip') 
            ctx.drawImage(this.sprite, pos.x, pos.y + oy, 32, 32);
    }

    update(dt) {
        let pos = offset(this.pos);
        let now = Date.now();
        let oy = this.state == 'idle' ? 0 : (now - this.stateTime) / 5.0;

        if(this.state == 'up') {
            oy *= -1;
            if(oy <= -8) {
                this.state = 'down';
                this.stateTime = now;
            }
        } else if(this.state == 'down') {
            oy -= 8;
            if(oy >= 0) {
                this.state = 'idle';
            }
        }
        
        if(this.state == 'flip') {
            let frame = ((now - this.stateTime) / 50.0) + 1;
            if(frame >= 4) {
                this.state = 'idle';
                this.stateTime = now;
            }
        }

        players.forEach((p) => {
            if(parseInt(p.pos.x + 0.5) == parseInt(this.pos.x) && parseInt(p.pos.y + 0.5) == parseInt(this.pos.y)) {
                p.vel.x -= 70 * dt;
            }
        });
    }

    fall() {
        if(this.on && this.state == 'idle') {
            this.state = 'flip';
            this.stateTime = Date.now();
        }
    }

    bonk() {
        if(this.state != 'idle' || this.on) return;
        this.state = 'up';
        this.stateTime = Date.now();

        this.on = true;
    }
};

setupLevel();

function updateLevel(dt) {
    for(let y = 0; y < levelHeight; y++) {
        for(let x = 0; x < levelWidth; x++) {
            if(level[y][x] == ' ') continue;
            let tile = getTile(level[y][x]);
            if(entities[`${x}:${y}`] != null && entities[`${x}:${y}`].update != null)
                entities[`${x}:${y}`].update(dt);
        }
    }
}

function update() {
    let dt = 20.0 / 1000.0;
    updateLevel(dt);

    players = players.filter((p) => p.alive);
    players.forEach((player) => player.update(dt));
}

setInterval(update, 20);