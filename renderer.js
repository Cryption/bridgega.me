let oldTime = Date.now();

function drawLevel(dt) {
    let ox = width / 2 - levelWidth * 16;
    let oy = height - levelHeight * 32;

    for(let y = 0; y < levelHeight; y++) {
        for(let x = 0; x < levelWidth; x++) {
            if(level[y][x] == ' ') continue;
            let tile = getTile(level[y][x]);
            if(tile instanceof HTMLImageElement)
                ctx.drawImage(tile, ox + x * 32, oy + y * 32, 32, 32);
            else if(entities[`${x}:${y}`] != null && entities[`${x}:${y}`].draw != null)
                entities[`${x}:${y}`].draw(dt);
        }
    }
}

function draw() {
    let now = Date.now(); 
    let dt = (now - oldTime) / 1000.0;
    oldTime = now;

    if(dt < 0.25) {
        ctx.save();

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);

        drawLevel(dt);
        players.forEach((player) => player.draw(dt));

        ctx.restore();
    }
    window.requestAnimationFrame(draw);
}

window.requestAnimationFrame(draw);