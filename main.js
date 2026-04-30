window.LabState = { inventory: [], handItem: null, timeDays: 0 };
window.LabInventory = { mixes: window.LabState.inventory };
window.isMobileTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
window.gameActive = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe2e8f0);
scene.fog = new THREE.FogExp2(0xe2e8f0, 0.015);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 0);

const playerHand = new THREE.Group();
playerHand.position.set(0.3, -0.2, -0.6);
camera.add(playerHand);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('canvasContainer').appendChild(renderer.domElement);

function generateRealLabFloor() {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#94a3b8'; 
    ctx.fillRect(0,0,1024,1024);
    for(let i=0; i<60000; i++) {
        const r = Math.random();
        if(r < 0.3) ctx.fillStyle = '#55647c'; 
        else if(r < 0.6) ctx.fillStyle = '#55647c'; 
        else if(r < 0.8) ctx.fillStyle = '#55647c'; 
        else ctx.fillStyle = '#cbd5e1'; 
        ctx.fillRect(Math.random()*1024, Math.random()*1024, 4, 4);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 4;
    for(let i=0; i<=1024; i+=256) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
    }
    ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 8;
    ctx.strokeRect(64, 64, 896, 896);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 4);
    return tex;
}

function generateRealLabWall() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0,0,512,512);
    ctx.fillStyle = '#1e3a8a'; ctx.fillRect(0, 300, 512, 212);
    ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, 290, 512, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 2;
    for(let y=0; y<512; y+=32) {
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(512,y); ctx.stroke();
        for(let x=0; x<512; x+=64) {
            let offset = (y%64 === 0) ? 32 : 0;
            ctx.beginPath(); ctx.moveTo(x + offset, y); ctx.lineTo(x + offset, y+32); ctx.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 2);
    return tex;
}

scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.8));
const sunLight = new THREE.DirectionalLight(0xffffff, 0.4); 
sunLight.position.set(10, 8, 5); 
sunLight.castShadow = true; 
sunLight.shadow.mapSize.width = 1024; 
sunLight.shadow.mapSize.height = 1024; 
sunLight.shadow.bias = -0.0005; 
scene.add(sunLight);

const floorMat = new THREE.MeshStandardMaterial({ map: generateRealLabFloor(), roughness: 0.2, metalness: 0.1 });
const wallMat = new THREE.MeshStandardMaterial({ map: generateRealLabWall(), roughness: 0.9 });

const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 24), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const ceilBaseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 }); 
const ceilBase = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), ceilBaseMat); 
ceilBase.rotation.x = Math.PI / 2; ceilBase.position.y = 6.6; 
scene.add(ceilBase);

function getAcousticTex() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,512,512); 
    ctx.fillStyle = '#e2e8f0';
    
    for(let i=0; i<2000; i++) {
        ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*512, Math.random()*1.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(109, 3, 3, 0.06)'; ctx.lineWidth = 3;
    for(let i=0; i<=512; i+=128) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(512,i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

const panelMat = new THREE.MeshLambertMaterial({ map: getAcousticTex() }); 
const coveLightMat = new THREE.MeshBasicMaterial({ color: 0x1e3a8a }); 
const frameMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); 
const ventMat = new THREE.MeshBasicMaterial({ color: 0x111111 }); 

function createPremiumCeilingPanel(w, d, x, z) {
    const group = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.12, d + 0.08), frameMat);
    frame.position.y = 6.0; frame.castShadow = true; group.add(frame);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), panelMat);
    panel.position.y = 5.99; 
    panel.material.map.repeat.set(w/2, d/2); 
    group.add(panel);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.05, d + 0.4), coveLightMat);
    glow.position.y = 6.1; group.add(glow);
    const lightRimMat = new THREE.MeshBasicMaterial({color: 0xe2e8f0});
    const bulbMat = new THREE.MeshBasicMaterial({color: 0xffffff});

    for(let px = -w/2 + 1; px < w/2; px += 2.5) {
        for(let pz = -d/2 + 1; pz < d/2; pz += 2.5) {
            if (Math.random() > 0.25) {
                const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 10), lightRimMat);
                rim.position.set(px, 5.95, pz); group.add(rim);
                const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.13, 10), bulbMat);
                bulb.position.set(px, 5.95, pz); group.add(bulb);
            } else {
                const vent = new THREE.Group();
                const vBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), ventMat); vent.add(vBase);
                for(let i=0.2; i<=0.4; i+=0.2) {
                    const louverGeom = new THREE.BoxGeometry(i, 0.13, i);
                    const louverMat = new THREE.MeshStandardMaterial({color:0xe2e8f0, metalness:0.3});
                    const louver = new THREE.Mesh(louverGeom, louverMat); vent.add(louver);
                }
                vent.position.set(px, 5.95, pz); group.add(vent);
            }
        }
    }

    const wireMat = new THREE.MeshStandardMaterial({color: 0x333333, metalness: 0.8, roughness: 0.5});
    [[-w/2 + 0.1, -d/2 + 0.1], [w/2 - 0.1, -d/2 + 0.1], [-w/2 + 0.1, d/2 - 0.1], [w/2 - 0.1, d/2 - 0.1]].forEach(pos => {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.6, 3), wireMat);
        wire.position.set(pos[0], 6.3, pos[1]); group.add(wire);
    });

    group.position.set(x, 0, z); scene.add(group);
}

createPremiumCeilingPanel(10, 8, -10, -6); createPremiumCeilingPanel(10, 8, 10, -6);
createPremiumCeilingPanel(10, 8, -10, 6); createPremiumCeilingPanel(10, 8, 10, 6);
createPremiumCeilingPanel(6, 18, 0, 0); 

const wallN = new THREE.Mesh(new THREE.BoxGeometry(36, 6.2, 0.5), wallMat); wallN.position.set(0, 3.1, -12.25); scene.add(wallN);
const wallS = new THREE.Mesh(new THREE.BoxGeometry(36, 6.2, 0.5), wallMat); wallS.position.set(0, 3.1, 12.25); scene.add(wallS);
const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 24), wallMat); wallE.position.set(18.25, 3.1, 0); scene.add(wallE);
const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 24), wallMat); wallW.position.set(-18.25, 3.1, 0); scene.add(wallW);

const steelBeamMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.5, metalness: 0.2 });
function createHBeam(x, z) {
    const group = new THREE.Group();
    const web = new THREE.Mesh(new THREE.BoxGeometry(0.05, 6.2, 0.25), steelBeamMat); web.castShadow = true; web.receiveShadow = true; group.add(web);
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6.2, 0.05), steelBeamMat); f1.position.z = 0.125; f1.castShadow = true; group.add(f1);
    const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6.2, 0.05), steelBeamMat); f2.position.z = -0.125; f2.castShadow = true; group.add(f2);
    group.position.set(x, 3.1, z); scene.add(group);
}
[[-17.8, -11.8], [17.8, -11.8], [-17.8, 11.8], [17.8, 11.8], [0, -11.8], [0, 11.8], [-17.8, 0], [17.8, 0], [-9, -11.8], [9, -11.8], [-9, 11.8], [9, 11.8]].forEach(pos => createHBeam(pos[0], pos[1]));

const exhaustFans = [];
function createExhaustFan(x, y, z, rotY) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = rotY;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.1), new THREE.MeshStandardMaterial({color: 0x334155, metalness: 0.5})); group.add(frame);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 32), new THREE.MeshBasicMaterial({color: 0x000000})); hole.rotation.x = Math.PI/2; group.add(hole);
    const blades = new THREE.Group(); const bladeMat = new THREE.MeshStandardMaterial({color: 0x94a3b8, metalness: 0.8, roughness: 0.2});
    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 16), bladeMat); center.rotation.x = Math.PI/2; blades.add(center);
    for(let i=0; i<5; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.02), bladeMat); blade.position.y = 0.3;
        const pivot = new THREE.Group(); pivot.rotation.z = (Math.PI * 2 / 5) * i; pivot.add(blade); blade.rotation.x = Math.PI / 5; blades.add(pivot);
    }
    blades.position.z = 0.05; group.add(blades);
    const grillMat = new THREE.MeshStandardMaterial({color: 0x0f172a});
    for(let i=-0.6; i<=0.6; i+=0.1) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.3), grillMat); bar.position.set(i, 0, 0.15); group.add(bar);
        const barH = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.3), grillMat); barH.rotation.z = Math.PI/2; barH.position.set(0, i, 0.15); group.add(barH);
    }
    scene.add(group); exhaustFans.push(blades);
}
createExhaustFan(-12, 4.0, -12.0, 0); createExhaustFan(-2, 4.0, 12.0, Math.PI); createExhaustFan(18.0, 4.0, 4, -Math.PI/2);


function createPremiumWhiteboard(title, text) {
    const group = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x020617, metalness: 0.9, roughness: 0.1 });
    const frameGeom = new THREE.BoxGeometry(2.1, 1.4, 0.05);
    const frame = new THREE.Mesh(frameGeom, frameMat); frame.castShadow = true; group.add(frame);

    const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 1024; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 2048, 1024); ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
    for(let i = 0; i < 2048; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke(); }
    for(let i = 0; i < 1024; i += 64) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(2048, i); ctx.stroke(); }
    ctx.fillStyle = '#0284c7'; ctx.fillRect(0, 0, 2048, 160);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 90px Space Grotesk, Arial'; ctx.textAlign = 'center'; ctx.fillText(title.toUpperCase(), 1024, 110);
    ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'left';
    const lines = text.split('\n'); let y = 280;
    lines.forEach(line => {
        if(line.includes('ASTM') || line.includes('ACI')) { ctx.font = 'bold 64px JetBrains Mono, monospace'; ctx.fillStyle = '#38bdf8'; }
        else { ctx.font = 'bold 52px JetBrains Mono, monospace'; ctx.fillStyle = '#e2e8f0'; }
        ctx.fillText(line, 100, y); y += 90;
    });
    ctx.fillStyle = '#475569'; ctx.font = 'italic 40px Space Grotesk, Arial'; ctx.textAlign = 'right'; ctx.fillText('ACI HU Chapter', 1980, 980);

    const tex = new THREE.CanvasTexture(canvas); tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.1 });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.3), boardMat); board.position.z = 0.026; group.add(board);
    return group;
}

const boardData = [
    { title: "SAFETY PROTOCOLS", text: "MANDATORY LAB PPE:\n- Hard Hat (ANSI Z89.1)\n- Steel Toe Boots\n- Safety Goggles\n\nNo loose clothing around machinery.", pos: [0, 2.5, -9.9], rot: 0 },
    { title: "CONCRETE MIX DESIGN", text: "ACI 211.1 Mix Design:\n\n1. Select target Slump & Strength (f'c).\n2. Determine Water & Air content.\n3. Calculate W/C Ratio.\n4. Calculate Cement, Coarse, & Fine Agg.", pos: [-14.9, 2.5, -5], rot: Math.PI/2 },
    { title: "SAMPLE PREPARATION", text: "ASTM C192\n\nMaking & Curing Concrete Test Specimens.\nCalculates W/C ratio and properly batches\naggregate, cement, and water.", pos: [-14.9, 2.5, -1], rot: Math.PI/2 },
    { title: "CURING TANK", text: "ASTM C511 & Pathology\n\nStandard Moist Cabinet/Water Storage.\nMarine environment toggle simulates chloride\ningress and structural corrosion.", pos: [-12, 2.5, 9.9], rot: Math.PI },
    { title: "SIEVE ANALYSIS", text: "ASTM C136\n\nParticle Size Distribution.\nDetermines grading of fine and coarse\naggregates to ensure optimal mix density.", pos: [-5, 2.5, 9.9], rot: Math.PI },
    { title: "LA ABRASION", text: "ASTM C131\n\nResistance to Degradation.\nMeasures aggregate toughness and abrasion\nusing steel spheres in a rotating drum.", pos: [2, 2.5, 9.9], rot: Math.PI },
    { title: "CBR SOIL TEST", text: "ASTM D1883\n\nCalifornia Bearing Ratio.\nEvaluates the mechanical strength of\nroad subgrades and basecourses.", pos: [9, 2.5, 9.9], rot: Math.PI },
    { title: "UTM (MECHANICAL)", text: "ASTM C39 & A370\n\nCompressive & Tensile Strength.\nApplies controlled loads to cylinders and\nrebar to determine yield capacity.", pos: [14.9, 2.5, 4], rot: -Math.PI/2 },
    { title: "SLUMP TEST", text: "ASTM C143\n\nConcrete Consistency & Workability.\nMeasures the subsidence of fresh concrete\nto evaluate water content and flowability.", pos: [14.9, 2.5, -3], rot: -Math.PI/2 },
    { title: "OVEN STATION", text: "ASTM C566 / C642\n\nMoisture Content & Absorption.\nBakes specimens at 110°C to determine\nevaporable water and void volume.", pos: [-6, 2.5, -9.9], rot: 0 },
    { title: "NDT DIAGNOSTICS", text: "ASTM C805 & C597 & D4748\n\nNon-Destructive Testing.\nRebound Hammer, UPV, and GPR for\nflaw detection and rebar locating.", pos: [6, 2.5, -9.9], rot: 0 }
];

boardData.forEach(data => {
    const board = createPremiumWhiteboard(data.title, data.text);
    board.position.set(...data.pos); board.rotation.y = data.rot;
    board.rotation.x = data.rot === 0 || data.rot === Math.PI ? 0.05 : 0;
    if(data.rot === Math.PI/2 || data.rot === -Math.PI/2) board.rotation.z = 0.05;
    scene.add(board);
});


let currentNbPage = 0;
let totalNbPages = 0;

window.updateNbPagination = function() {
    document.getElementById('notebookSlider').style.transform = `translateX(-${currentNbPage * 100}%)`;
    document.getElementById('nbPrevBtn').style.display = currentNbPage > 0 ? 'block' : 'none';
    document.getElementById('nbNextBtn').style.display = currentNbPage < totalNbPages - 1 ? 'block' : 'none';
};

document.getElementById('nbPrevBtn').addEventListener('click', () => { if(currentNbPage > 0) { currentNbPage--; window.updateNbPagination(); }});
document.getElementById('nbNextBtn').addEventListener('click', () => { if(currentNbPage < totalNbPages - 1) { currentNbPage++; window.updateNbPagination(); }});

window.goToNbPage = function(index) {
    currentNbPage = index;
    window.updateNbPagination();
};

window.roughLine = function(ctx, x1, y1, x2, y2, thickness=2, color="#1e3a8a") {
    ctx.strokeStyle = color; 
    ctx.lineWidth = thickness * (0.8 + Math.random() * 0.4);
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(x1, y1);
    let mx = (x1+x2)/2 + (Math.random()-0.5)*(thickness*3); 
    let my = (y1+y2)/2 + (Math.random()-0.5)*(thickness*3);
    ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    ctx.lineWidth = thickness * 0.4; 
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.moveTo(x1+(Math.random()-0.5)*4, y1+(Math.random()-0.5)*4);
    ctx.lineTo(x2+(Math.random()-0.5)*4, y2+(Math.random()-0.5)*4); ctx.stroke();
    ctx.globalAlpha = 1.0; 
};

window.drawEngineeringSketch = async function(container, item, fastMode = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 450; canvas.height = 700; 
    canvas.className = 'hw-canvas-left';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = 'multiply';

    function roughLine(x1, y1, x2, y2, thickness=2, color="#1e3a8a") { window.roughLine(ctx, x1, y1, x2, y2, thickness, color); }
    function drawArrow(x, y, dir="down") {
        roughLine(x, y-25, x, y, 2, "#ef4444");
        if(dir === "down") { roughLine(x-6, y-8, x, y, 2, "#ef4444"); roughLine(x+6, y-8, x, y, 2, "#ef4444"); }
        if(dir === "up") { roughLine(x-6, y-17, x, y-25, 2, "#ef4444"); roughLine(x+6, y-17, x, y-25, 2, "#ef4444"); }
    }
    function roughEllipse(x, y, rx, ry, isWavy=false) {
        ctx.strokeStyle = "#1e3a8a"; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
        ctx.beginPath(); let segments = 24;
        for(let i=0; i<=segments+1; i++) {
            let angle = (i / segments) * Math.PI * 2;
            let px = x + rx * Math.cos(angle) + (Math.random()-0.5)*(isWavy?4:2); 
            let py = y + ry * Math.sin(angle) + (Math.random()-0.5)*(isWavy?4:2);
            if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.stroke(); ctx.globalAlpha = 1.0;
    }
    function drawAxes(x, y, w, h, labelX, labelY) {
        roughLine(x, y, x, y-h); roughLine(x, y, x+w, y);
        ctx.font = "18px Kalam, Caveat, cursive"; ctx.fillStyle = "#1e3a8a";
        ctx.fillText(labelX, x+w-40, y+20);
        ctx.save(); ctx.translate(x-20, y-h+40); ctx.rotate(-Math.PI/2); ctx.fillText(labelY, 0, 0); ctx.restore();
    }
    function drawDashed(x1, y1, x2, y2) {
        ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(30, 58, 138, 0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
    }

    let commands = [];
    const topY = 150; 
    const botY = 600; 

    if (item.testType === 'tensile' || item.type === 'steel') {
        const area = 201.06; const fy = ((item.maxLoad * 0.75 * 1000) / area).toFixed(1); const fu = ((item.maxLoad * 1000) / area).toFixed(1);
        commands.push(() => { roughLine(200, topY-50, 200, topY); roughLine(220, topY-50, 220, topY); }); 
        commands.push(() => { roughLine(200, topY, 205, topY+20); roughLine(220, topY, 215, topY+20); }); 
        commands.push(() => { roughLine(205, topY+35, 200, topY+55); roughLine(215, topY+35, 220, topY+55); }); 
        commands.push(() => { roughLine(200, topY+55, 200, topY+105); roughLine(220, topY+55, 220, topY+105); }); 
        commands.push(() => { roughLine(195, topY+20, 225, topY+35, 2, "#ef4444"); }); 
        commands.push(() => { drawArrow(210, topY-55, "up"); drawArrow(210, topY+140, "down"); ctx.font="20px Caveat, cursive"; ctx.fillStyle="#ef4444"; ctx.fillText("P", 190, topY-70); ctx.fillText("P", 190, topY+130);});
        
        commands.push(() => drawAxes(80, botY, 300, 220, "Strain (ε)", "Stress (σ)"));
        commands.push(() => { roughLine(80, botY, 150, botY-120, 2, "#2563eb"); }); 
        commands.push(() => { roughLine(150, botY-120, 200, botY-120, 2, "#2563eb"); drawDashed(80, botY-120, 150, botY-120); ctx.fillStyle="#ef4444"; ctx.fillText(`fy = ${fy} MPa`, 100, botY-125); }); 
        commands.push(() => { roughLine(200, botY-120, 300, botY-170, 2, "#2563eb"); drawDashed(80, botY-170, 300, botY-170); ctx.fillStyle="#ef4444"; ctx.fillText(`fu = ${fu} MPa`, 100, botY-175); }); 
        commands.push(() => { roughLine(300, botY-170, 360, botY-100, 2, "#ef4444"); ctx.fillText("Rupture", 350, botY-80); }); 
    } 
    else if (item.testType === 'compression' && item.type === 'cylinder') {
        const area = 17671.46; const fc = ((item.maxLoad * 1000) / area).toFixed(1); const frup = item.ruptureLoad ? ((item.ruptureLoad * 1000) / area).toFixed(1) : fc;
        
        commands.push(() => { roughEllipse(225, topY-70, 50, 15, true); }); 
        commands.push(() => { roughEllipse(225, topY+70, 50, 15, true); }); 
        commands.push(() => { roughLine(175, topY-70, 175, topY+70); roughLine(275, topY-70, 275, topY+70); }); 
        commands.push(() => { roughLine(160, topY-100, 290, topY-100); roughLine(160, topY+100, 290, topY+100); }); 
        commands.push(() => { roughLine(180, topY-60, 270, topY+60, 2, "#ef4444"); roughLine(270, topY-60, 180, topY+60, 2, "#ef4444"); }); 
        commands.push(() => { drawArrow(225, topY-110, "down"); drawArrow(225, topY+135, "up"); ctx.font="24px Caveat, cursive"; ctx.fillStyle="#ef4444"; ctx.fillText("P", 245, topY-120); ctx.fillText("P", 245, topY+145); });
        
        commands.push(() => drawAxes(80, botY, 300, 220, "Strain (ε)", "Stress (σ)"));
        commands.push(() => { roughLine(80, botY, 180, botY-140, 2, "#2563eb"); }); 
        commands.push(() => { roughLine(180, botY-140, 240, botY-170, 2, "#2563eb"); }); 
        commands.push(() => { roughLine(240, botY-170, 300, botY-120, 2, "#ef4444"); }); 
        commands.push(() => { drawDashed(80, botY-170, 240, botY-170); ctx.fillStyle="#2563eb"; ctx.fillText(`f'c = ${fc} MPa`, 100, botY-175); });
        commands.push(() => { drawDashed(80, botY-120, 300, botY-120); ctx.fillStyle="#ef4444"; ctx.fillText(`f_rup = ${frup} MPa`, 100, botY-125); ctx.fillText("Fracture", 310, botY-110); });
    }
    else if (item.type === 'cube') {
        const area = 22500; const fc = ((item.maxLoad * 1000) / area).toFixed(1);
        commands.push(() => { roughLine(175, topY-50, 275, topY-50); roughLine(275, topY-50, 275, topY+50); roughLine(275, topY+50, 175, topY+50); roughLine(175, topY+50, 175, topY-50); }); 
        commands.push(() => { roughLine(175, topY-50, 200, topY-80); roughLine(275, topY-50, 300, topY-80); roughLine(275, topY+50, 300, topY+20); }); 
        commands.push(() => { roughLine(200, topY-80, 300, topY-80); roughLine(300, topY-80, 300, topY+20); }); 
        commands.push(() => { roughLine(175, topY-50, 275, topY+50, 2, "#ef4444"); roughLine(275, topY-50, 175, topY+50, 2, "#ef4444"); }); 
        commands.push(() => { drawArrow(225, topY-110, "down"); drawArrow(225, topY+100, "up"); ctx.font="24px Caveat, cursive"; ctx.fillStyle="#ef4444"; ctx.fillText("P", 245, topY-120); });
        
        commands.push(() => drawAxes(80, botY, 300, 220, "Strain (ε)", "Stress (σ)"));
        commands.push(() => { roughLine(80, botY, 180, botY-140, 2, "#2563eb"); roughLine(180, botY-140, 240, botY-160, 2, "#2563eb"); }); 
        commands.push(() => { roughLine(240, botY-160, 320, botY-80, 2, "#ef4444"); }); 
        commands.push(() => { drawDashed(80, botY-160, 240, botY-160); ctx.fillStyle="#ef4444"; ctx.fillText(`f'c = ${fc} MPa`, 100, botY-165); });
    }
    else if (item.testType === 'splitting') {
        commands.push(() => { roughEllipse(225, topY, 60, 60); }); 
        commands.push(() => { roughLine(190, topY-75, 260, topY-75); roughLine(190, topY+75, 260, topY+75); }); 
        commands.push(() => { drawArrow(225, topY-85, "down"); drawArrow(225, topY+115, "up"); ctx.font="20px Caveat, cursive"; ctx.fillStyle="#ef4444"; ctx.fillText("P", 245, topY-90); ctx.fillText("P", 245, topY+115); });
        commands.push(() => { roughLine(225, topY-60, 225, topY+60, 2, "#ef4444"); }); 
        
        commands.push(() => { roughLine(160, topY, 110, topY, 2, "#ef4444"); roughLine(120, topY-5, 110, topY, 2, "#ef4444"); roughLine(120, topY+5, 110, topY, 2, "#ef4444"); }); 
        commands.push(() => { roughLine(290, topY, 340, topY, 2, "#ef4444"); roughLine(330, topY-5, 340, topY, 2, "#ef4444"); roughLine(330, topY+5, 340, topY, 2, "#ef4444"); }); 
        commands.push(() => { ctx.font="18px Caveat, cursive"; ctx.fillText("T", 90, topY+5); ctx.fillText("T", 350, topY+5); });
        
        commands.push(() => drawAxes(80, botY, 300, 220, "Displacement (δ)", "Load (P)"));
        commands.push(() => { roughLine(80, botY, 200, botY-150, 2, "#2563eb"); }); 
        commands.push(() => { roughLine(200, botY-150, 210, botY-40, 2, "#ef4444"); }); 
        commands.push(() => { drawDashed(80, botY-150, 200, botY-150); ctx.fillStyle="#ef4444"; ctx.fillText(`P_max = ${item.maxLoad.toFixed(1)} kN`, 100, botY-155); });
    }
    else if (item.testType === 'flexural' || item.type === 'beam_rebar') {
        commands.push(() => { roughLine(75, topY-20, 375, topY-20); roughLine(75, topY+20, 375, topY+20); }); 
        commands.push(() => { roughLine(75, topY-20, 75, topY+20); roughLine(375, topY-20, 375, topY+20); }); 
        commands.push(() => { roughLine(125, topY+20, 105, topY+50); roughLine(125, topY+20, 145, topY+50); roughLine(105, topY+50, 145, topY+50); }); 
        commands.push(() => { roughLine(325, topY+20, 305, topY+50); roughLine(325, topY+20, 345, topY+50); roughLine(305, topY+50, 345, topY+50); }); 
        commands.push(() => { drawArrow(191, topY-30, "down"); drawArrow(258, topY-30, "down"); ctx.font="18px Caveat, cursive"; ctx.fillStyle="#ef4444"; ctx.fillText("P/2", 175, topY-60); ctx.fillText("P/2", 245, topY-60); }); 
        commands.push(() => { roughLine(225, topY+20, 220, topY, 2, "#ef4444"); roughLine(220, topY, 230, topY-10, 2, "#ef4444"); }); 
        
        commands.push(() => drawAxes(80, botY, 300, 220, "Deflection (δ)", "Load (P)"));
        commands.push(() => { roughLine(80, botY, 200, botY-120, 2, "#2563eb"); }); 
        commands.push(() => { roughLine(200, botY-120, 250, botY-150, 2, "#2563eb"); }); 
        commands.push(() => { roughLine(250, botY-150, 260, botY-50, 2, "#ef4444"); }); 
        commands.push(() => { drawDashed(80, botY-150, 250, botY-150); ctx.fillStyle="#ef4444"; ctx.fillText(`P_max = ${item.maxLoad.toFixed(1)} kN`, 90, botY-155); });
    }
    else {
        commands.push(() => { ctx.font="24px Caveat"; ctx.fillStyle="#000"; ctx.fillText("Plot Data Unavailable", 100, topY); });
    }

    for(let cmd of commands) { 
        cmd(); 
        if(!fastMode) await new Promise(r => setTimeout(r, 2)); 
    }
    
    item.calcSaved = true;
    item.calcHtmlLeft = container.innerHTML;
};

window.restoreCalculations = function(button, itemId) {
    const item = window.LabState.inventory.find(i => i.id === itemId);
    button.style.display = 'none';
    
    const rightContainer = document.getElementById(`calc-right-${item.id}`);
    rightContainer.style.display = 'block';
    rightContainer.innerHTML = item.calcHtmlRight;
    
    const leftContainer = document.getElementById(`calc-left-${item.id}`);
    leftContainer.innerHTML = '';
    window.drawEngineeringSketch(leftContainer, item, true); 
};

window.runHandwritingAnimation = async function(button, itemId) {
    const item = window.LabState.inventory.find(i => i.id === itemId);
    const containerRight = document.getElementById(`calc-right-${item.id}`);
    const containerLeft = document.getElementById(`calc-left-${item.id}`);

    button.disabled = true; button.textContent = "Processing Calculations...";
    containerRight.style.display = 'block';
    containerRight.style.position = 'relative'; 
    containerRight.innerHTML = '';
    
    const pen = document.createElement('div');
    pen.className = 'hw-pen';
    pen.style.position = 'absolute';
    pen.style.fontSize = '28px';
    pen.style.zIndex = '50';
    pen.innerHTML = '✍️';
    containerRight.appendChild(pen);

    const frac = (n, d) => `<div style="display:inline-flex; flex-direction:column; vertical-align:middle; text-align:center; font-size:0.85em; margin:0 6px; line-height: 1.2;"><span style="border-bottom:2px solid #1e3a8a; padding:0 4px;">${n}</span><span style="padding:0 4px;">${d}</span></div>`;
    const u = (text) => `<span style="color:#dc2626; font-weight:bold; margin-left:4px; font-family:'JetBrains Mono', monospace;">${text}</span>`;

    let lines = [];
    if (item.testType === 'tensile' || item.type === 'steel') {
        const area = 201.06; 
        const p_y = item.maxLoad * 0.75;
        const p_u = item.maxLoad;
        const fy = ((p_y * 1000) / area).toFixed(2); 
        const fu = ((p_u * 1000) / area).toFixed(2);
        
        lines.push(`<strong>[ ASTM A370 ]</strong> Steel Reinforcement Tensile Test`);
        lines.push(`<strong>1. Specimen Properties:</strong>`);
        lines.push(`Diameter (d) = 16 ${u("mm")}`);
        lines.push(`Area (A) = ${frac("π × d²", "4")} = ${frac("π × (16)²", "4")} = 201.06 ${u("mm²")}`);
        lines.push(`<strong>2. Recorded Loads:</strong>`);
        lines.push(`Yield Load (P<sub>y</sub>) = ${p_y.toFixed(2)} ${u("kN")}`);
        lines.push(`Ultimate Load (P<sub>u</sub>) = ${p_u.toFixed(2)} ${u("kN")}`);
        lines.push(`<strong>3. Stress Calculations:</strong>`);
        lines.push(`Yield Strength (F<sub>y</sub>) = ${frac("P<sub>y</sub>", "A")} = ${frac(`${p_y.toFixed(2)} × 10³ ${u("N")}`, `201.06 ${u("mm²")}`)} = <strong style="color:#d97706; font-size:1.1em;">${fy} ${u("MPa")}</strong>`);
        lines.push(`Ult. Strength (UTS) = ${frac("P<sub>u</sub>", "A")} = ${frac(`${p_u.toFixed(2)} × 10³ ${u("N")}`, `201.06 ${u("mm²")}`)} = <strong style="color:#b91c1c; font-size:1.1em;">${fu} ${u("MPa")}</strong>`);
        
    } else if (item.testType === 'flexural' || item.type === 'beam_rebar') {
        const p_max = item.maxLoad;
        const R = ((p_max * 600) / (200 * Math.pow(200, 2)) * 1000).toFixed(2);
        
        lines.push(`<strong>[ ASTM C78 ]</strong> Third-Point Loading Flexural Test`);
        lines.push(`<strong>1. Specimen & Test Geometry:</strong>`);
        lines.push(`Width (b) = 200 ${u("mm")}, Depth (d) = 200 ${u("mm")}`);
        lines.push(`Support Span (L) = 600 ${u("mm")}`);
        lines.push(`<strong>2. Recorded Data:</strong>`);
        lines.push(`Failure Load (P<sub>max</sub>) = ${p_max.toFixed(2)} ${u("kN")}`);
        lines.push(`<strong>3. Modulus of Rupture (R) Calculation:</strong>`);
        lines.push(`Formula: R = ${frac("P<sub>max</sub> × L", "b × d²")}`);
        lines.push(`Substitution: R = ${frac(`${(p_max*1000).toFixed(0)} ${u("N")} × 600 ${u("mm")}`, `200 ${u("mm")} × (200 ${u("mm")})²`)}`);
        lines.push(`Result: R = <strong style="color:#047857; font-size:1.2em;">${R} ${u("MPa")}</strong>`);
        
    } else if (item.testType === 'splitting') {
        const p_max = item.maxLoad;
        const T = ((2 * p_max * 1000) / (Math.PI * 300 * 150)).toFixed(2);
        
        lines.push(`<strong>[ ASTM C496 ]</strong> Splitting Tensile Strength`);
        lines.push(`<strong>1. Specimen Geometry:</strong>`);
        lines.push(`Length (L) = 300 ${u("mm")}, Diameter (D) = 150 ${u("mm")}`);
        lines.push(`<strong>2. Recorded Data:</strong>`);
        lines.push(`Maximum Load (P<sub>max</sub>) = ${p_max.toFixed(2)} ${u("kN")}`);
        lines.push(`<strong>3. Splitting Tensile Strength (T) Calculation:</strong>`);
        lines.push(`Formula: T = ${frac("2 × P<sub>max</sub>", "π × L × D")}`);
        lines.push(`Substitution: T = ${frac(`2 × ${(p_max*1000).toFixed(0)} ${u("N")}`, `π × 300 ${u("mm")} × 150 ${u("mm")}`)}`);
        lines.push(`Result: T = <strong style="color:#047857; font-size:1.2em;">${T} ${u("MPa")}</strong>`);
        
    } else if (item.testType === 'compression' && item.type === 'cylinder') {
        const area = 17671.46; 
        const p_max = item.maxLoad;
        const fc = ((p_max * 1000) / area).toFixed(2); 
        const frup = item.ruptureLoad ? ((item.ruptureLoad * 1000) / area).toFixed(2) : fc;
        const drop = item.ruptureLoad ? ((1 - item.ruptureLoad/p_max)*100).toFixed(1) : 0;
        
        lines.push(`<strong>[ ASTM C39 / ACI 318 ]</strong> Compressive Strength Analysis`);
        lines.push(`<strong>1. Cross-Sectional Area (A):</strong>`);
        lines.push(`Diameter (D) = 150 ${u("mm")}`);
        lines.push(`A = ${frac("π × D²", "4")} = ${frac(`π × (150)²`, "4")} = 17,671.46 ${u("mm²")}`);
        lines.push(`<strong>2. Compressive Strength (f'<sub>c</sub>):</strong>`);
        lines.push(`Peak Load (P<sub>max</sub>) = ${p_max.toFixed(2)} ${u("kN")}`);
        lines.push(`f'<sub>c</sub> = ${frac("P<sub>max</sub>", "A")} = ${frac(`${(p_max*1000).toFixed(0)} ${u("N")}`, `17671.46 ${u("mm²")}`)} = <strong style="color:#047857; font-size:1.2em;">${fc} ${u("MPa")}</strong>`);
        lines.push(`<strong>3. Fracture Diagnostics:</strong>`);
        lines.push(`Fracture Load (P<sub>rup</sub>) = ${item.ruptureLoad ? item.ruptureLoad.toFixed(2) : p_max.toFixed(2)} ${u("kN")}`);
        lines.push(`Rupture Stress (f<sub>rup</sub>) = ${frac("P<sub>rup</sub>", "A")} = ${frup} ${u("MPa")}`);
        lines.push(`Post-Peak Capacity Drop = <span style="color:#b91c1c;">${drop} ${u("%")}</span>`);
        
    } else {
        const area = 22500; 
        const p_max = item.maxLoad;
        const fc = ((p_max * 1000) / area).toFixed(2);
        
     lines.push(`<strong>[ ASTM C39 Adapted ]</strong> Cube Strength Analysis`);
        lines.push(`<strong>1. Cross-Sectional Area (A):</strong>`);
        lines.push(`Width = 150 ${u("mm")}, Depth = 150 ${u("mm")}`);
        lines.push(`A = 150 × 150 = 22,500 ${u("mm²")}`);
        lines.push(`<strong>2. Compressive Strength (f<sub>cu</sub>):</strong>`);
        lines.push(`Peak Load (P<sub>max</sub>) = ${p_max.toFixed(2)} ${u("kN")}`);
        lines.push(`Formula: f<sub>cu</sub> = ${frac("P<sub>max</sub>", "A")}`);
        lines.push(`Substitution: f<sub>cu</sub> = ${frac(`${(p_max*1000).toFixed(0)} ${u("N")}`, `22500 ${u("mm²")}`)}`);
        lines.push(`Result: f<sub>cu</sub> = <strong style="color:#047857; font-size:1.2em;">${fc} ${u("MPa")}</strong>`);
    }

    for(let i=0; i<lines.length; i++) {
        const lineWrap = document.createElement('div');
        lineWrap.className = 'mathcad-line';
        lineWrap.innerHTML = lines[i];
        
        lineWrap.style.clipPath = 'inset(0 100% 0 0)';
        containerRight.appendChild(lineWrap);
        
        const targetWidth = lineWrap.offsetWidth;
        const targetTop = lineWrap.offsetTop;
        const targetLeft = lineWrap.offsetLeft;

        gsap.set(pen, { left: targetLeft, top: targetTop });

        const animationSpeed = 1.2; 

        await new Promise(resolve => {
            gsap.to(lineWrap, { 
                clipPath: 'inset(0 0% 0 0)', 
                duration: animationSpeed,
                ease: "none"
            });
            gsap.to(pen, {
                left: targetLeft + targetWidth + 5,
                duration: animationSpeed, 
                ease: "none",
                onComplete: resolve 
            });
        });
    }
    
    pen.style.display = 'none'; 
    button.style.display = 'none';
    
    if(containerRight.contains(pen)) containerRight.removeChild(pen);
    
    item.calcSaved = true;
    item.calcHtmlRight = containerRight.innerHTML;
    
    await window.drawEngineeringSketch(containerLeft, item, false); 
};

window.toggleNotebook = function() {
    if(!window.gameActive) return;
    const nb = document.getElementById('labNotebook');
    
    if (nb.style.display === 'block') {
        nb.style.display = 'none';
        if(!window.isMobileTouch && !document.getElementById('osContainer').classList.contains('active') && document.getElementById('labTablet').style.display !== 'flex') {
            window.controls.lock();
        }
    } else {
        if(!window.isMobileTouch) window.controls.unlock();
        nb.style.display = 'block';
        
        const slider = document.getElementById('notebookSlider');
        slider.innerHTML = '';
        currentNbPage = 0;
        
        const coverPage = document.createElement('div');
        coverPage.className = 'notebook-spread cover-spread';
        coverPage.innerHTML = `
            <div class="notebook-cover-real">
                <div class="cover-spine"></div>
                <div class="cover-text">
                    <h1 class="gold-foil">ACI HU 2026</h1>
                    <h2 class="debossed">STUDENT NOTEBOOK</h2>
                    <h3 class="debossed-small">BUILDING MATERIAL DIGITAL-TWIN</h3>
                </div>
                <div class="elastic-band"></div>
            </div>
        `;
        slider.appendChild(coverPage);

        const items = window.LabState.inventory;
        const batches = {};
        items.forEach(item => {
            if (!batches[item.batchId]) batches[item.batchId] = { mixName: item.mixName, wc: item.c > 0 ? (item.w/item.c).toFixed(2) : 'N/A', w: item.w, c: item.c, s: item.s, g: item.g, items: [] };
            batches[item.batchId].items.push(item);
        });

        const mixSpread = document.createElement('div');
        mixSpread.className = 'notebook-spread';
        
        let leftHTML = `
            <div class="page-left">
                <span class="nb-title" style="color: #b91c1c; border-bottom-color: #b91c1c;">⚠ SAFETY PROTOCOLS</span>
                <div style="margin-top: 20px; font-family: 'JetBrains Mono', monospace; font-size: 18px; color: #334155; line-height: 1.6;">
                    <p><strong style="color: #b91c1c;">[!] REQUIRED PPE FOR BATCHING:</strong></p>
                    <ul style="list-style-type: square; padding-left: 20px; margin-bottom: 25px;">
                        <li>N95 Particulate Respirator (Silica Dust Hazard)</li>
                        <li>ANSI Z87.1 Safety Goggles</li>
                        <li>Heavy-Duty Nitrile Gloves</li>
                        <li>Steel-Toe Footwear</li>
                    </ul>
                    <p><strong style="color: #b91c1c;">[!] OPERATIONAL HAZARDS:</strong></p>
                    <ul style="list-style-type: square; padding-left: 20px;">
                        <li>Keep hands and loose clothing clear of rotating mixer blades.</li>
                        <li>Ensure wall-mounted exhaust fans are ACTIVE before handling dry cement to prevent inhalation.</li>
                        <li>Verify scale tare weights before formulation.</li>
                    </ul>
                </div>
                <div style="position: relative; margin-top: 40px; text-align: center; border-top: 2px dashed #94a3b8; padding-top: 30px; padding-bottom: 30px;">
                    <p style="font-family: 'Caveat', cursive; font-size: 34px; color: #1e3a8a; margin: 0; line-height: 1.2;">
                        "Today a student of engineering,<br>tomorrow a builder of empires."
                    </p>
                </div>
            </div>
        `;

        let rightHTML = `<div class="page-right"><span class="nb-title">Mix Design Details</span>`;
        if (Object.keys(batches).length === 0) {
            rightHTML += `<p style="font-size: 24px; color: #64748b; margin-top:20px;">[ Not Done Yet ]</p>`;
        } else {
            Object.keys(batches).forEach(bId => {
                const batch = batches[bId];
                if (bId.toString().startsWith('std_')) return;
                rightHTML += `<div style="margin-bottom: 20px;">
                    <h3 style="margin:0; font-size:26px;">Mix: ${batch.mixName}</h3>
                    <ul class="check-list">
                        <li><span>☑</span> Cement: ${batch.c} kg</li>
                        <li><span>☑</span> Water: ${batch.w} kg</li>
                        <li><span>☑</span> Sand: ${batch.s} kg</li>
                        <li><span>☑</span> Gravel: ${batch.g} kg</li>
                        <li><span>☑</span> W/C Ratio: ${batch.wc}</li>
                    </ul>
                </div>`;
            });
        }
        rightHTML += `</div>`;

        mixSpread.innerHTML = leftHTML + rightHTML;
        slider.appendChild(mixSpread);
        
        totalNbPages = 2 + items.length;
        let pageCount = 1;

        items.slice().reverse().forEach(item => {
            pageCount++;
            const sampleSpread = document.createElement('div');
            sampleSpread.className = 'notebook-spread';

            const isStandard = item.id.toString().startsWith('std_');
            const dims = item.type === 'cylinder' ? 'Ø 150mm x 300mm' : (item.type === 'cube' ? '150 x 150 x 150mm' : (item.type === 'steel' ? 'Ø 16mm x 500mm' : '200 x 200 x 800mm'));
            const typeText = item.testType ? item.testType.toUpperCase() : item.type.toUpperCase();
            const ageStr = item.tested ? `${item.age} Days (At Failure)` : `${item.age || 0} Days (Current)`;
            const maxLoad = item.tested && item.maxLoad ? `${item.maxLoad.toFixed(2)} kN` : '<span style="color:#ef4444; font-style:italic;">Awaiting Test</span>';

            let calcHTML = item.tested ? `<button class="calc-strength-btn" onclick="runHandwritingAnimation(this, '${item.id}')">📎 Process Calculations</button>` : '';
            if (item.calcSaved) calcHTML = `<button class="calc-strength-btn" onclick="restoreCalculations(this, '${item.id}')">📎 View Calculations</button>`;

            sampleSpread.innerHTML = `
                <div class="page-left" id="calc-left-${item.id}">
                </div>
                <div class="page-right">
                    <span class="nb-title">Specimen: ${item.name}</span>
                    <div style="margin-bottom: 20px; font-size: 24px;">
                        <p><strong>Mix:</strong> ${item.mixName || 'Standard Default'}</p>
                        <p><strong>Type:</strong> ${typeText} (${dims})</p>
                        ${item.type !== 'steel' ? `<p><strong>Age:</strong> ${ageStr}</p>` : ''}
                        <p><strong>Max Load:</strong> <span style="color:#16a34a;">${maxLoad}</span></p>
                    </div>
                    ${calcHTML}
                    <div id="calc-right-${item.id}" class="hw-text-container" style="display:none;"></div>
                </div>
            `;
            slider.appendChild(sampleSpread);
            
            if (item.calcSaved) {
                setTimeout(() => window.drawEngineeringSketch(document.getElementById(`calc-left-${item.id}`), item, true), 50);
            }
        });

        window.updateNbPagination();
    }
};

document.getElementById('closeNotebookBtn').addEventListener('click', window.toggleNotebook);
if(document.getElementById('mobNotebook')) { document.getElementById('mobNotebook').addEventListener('touchstart', (e) => { e.preventDefault(); window.toggleNotebook(); }); }

const style = document.createElement('style');
style.innerHTML = `
    #labNotebook { display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90vw; max-width: 1500px; height: 85vh; max-height: 850px; z-index: 3000; font-family: 'Caveat', cursive; color: #1e3a8a; }
    .notebook-slider { display: flex; height: 100%; transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1); }
    .notebook-spread { display: flex; width: 100%; flex-shrink: 0; box-shadow: 0 30px 60px rgba(0,0,0,0.9); border-radius: 10px; overflow: hidden; position: relative;}
    
    .cover-spread { background: transparent; box-shadow: none; justify-content: flex-end; perspective: 1500px; }
    .notebook-cover-real { width: 50%; height: 100%; position: relative; background-color: #5c0a0a; border-radius: 4px 16px 16px 4px; box-shadow: inset 10px 0 20px rgba(0,0,0,0.6), 15px 15px 30px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,0,0,0.4); overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; border-right: 2px solid #3a0606; border-top: 1px solid #7a0d0d; }
    .notebook-cover-real::before { content: ""; position: absolute; inset: 0; opacity: 0.15; background-image: repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 4px); pointer-events: none; }
    .cover-spine { position: absolute; left: 0; top: 0; bottom: 0; width: 45px; background: linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 20%, rgba(255,255,255,0.1) 80%, rgba(0,0,0,0.6) 100%); border-right: 2px solid rgba(0,0,0,0.4); }
    .cover-text { text-align: center; z-index: 2; width: 80%; padding-left: 20px; }
    .gold-foil { font-family: 'Space Grotesk', sans-serif; font-size: 52px; color: #eab308; text-shadow: 1px 1px 2px #713f12, -1px -1px 1px #fef08a, 0 2px 4px rgba(0,0,0,0.8); margin: 0; letter-spacing: 3px; }
    .debossed { font-family: 'Space Grotesk', sans-serif; font-size: 28px; color: #3a0606; text-shadow: 1px 1px 1px rgba(255,255,255,0.15), -1px -1px 2px rgba(0,0,0,0.8); margin: 25px 0 10px 0; letter-spacing: 1px; }
    .debossed-small { font-family: 'Space Grotesk', sans-serif; font-size: 18px; color: #3a0606; text-shadow: 1px 1px 1px rgba(255,255,255,0.15), -1px -1px 2px rgba(0,0,0,0.8); margin: 0; letter-spacing: 2px;}
    .elastic-band { position: absolute; right: 35px; top: 0; bottom: 0; width: 14px; background: #111; box-shadow: inset 3px 0 6px rgba(0,0,0,0.8), 3px 0 6px rgba(0,0,0,0.6); }

    .page-left { width: 50%; height: 100%; background-color: #f8fafc; background-image: linear-gradient(to right, rgba(56, 189, 248, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.2) 1px, transparent 1px); background-size: 20px 20px; padding: 30px; box-shadow: inset -10px 0 15px rgba(0,0,0,0.05); position: relative; overflow-y: auto; overflow-x: hidden; }
    .page-right { width: 50%; height: 100%; background-color: #f8fafc; background-image: linear-gradient(transparent 95%, rgba(56, 189, 248, 0.3) 5%); background-size: 100% 32px; background-position: 0 5px; padding: 40px 30px 40px 50px; box-shadow: inset 10px 0 15px rgba(0,0,0,0.05); position: relative; overflow-y: auto; font-size: 26px; line-height: 32px; border-left: 2px solid rgba(0,0,0,0.1); }
    
    .nb-title { font-size: 36px; color: #0f172a; border-bottom: 2px solid #1d4ed8; font-weight: bold; display: inline-block; margin-bottom: 20px; line-height: 1.2; }
    .check-list { list-style: none; padding: 0; margin: 0; }
    .check-list li { margin-bottom: 10px; font-size: 24px; color: #1e3a8a; }
    .check-list span { color: #16a34a; font-weight: bold; margin-right: 10px; }

    .calc-strength-btn { background: transparent; color: #ef4444; border: 2px dashed #ef4444; padding: 5px 15px; border-radius: 6px; font-family: 'Caveat', cursive; font-size: 24px; font-weight: bold; margin-top: 15px; cursor: pointer; transition: 0.2s; }
    .calc-strength-btn:hover { background: rgba(239, 68, 68, 0.1); }
    
    .hw-text-container { margin-top: 20px; color: #1e3a8a; font-size: 24px; line-height: 32px; }
    .mathcad-line { font-family: 'JetBrains Mono', monospace; font-size: 18px; color: #1e3a8a; margin-bottom: 15px; white-space: nowrap; overflow: hidden; display: block; width: max-content; }
    .hw-canvas-left { width: 100%; height: 100%; position: absolute; top:0; left:0; pointer-events:none; }
`;
document.head.appendChild(style);

class MasterDesk {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); this.group.position.set(x, 0, z);
        this.uiID = 'masterUI'; this.uiVisible = false; this.name = "Lab Director Desk";
        
        this.appState = 'desktop'; 
        this.selectedBatchId = null;

        const deskMat = new THREE.MeshStandardMaterial({color: 0x1e293b, roughness: 0.6});
        const table = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.05, 1.5), deskMat); table.position.set(0, 0.8, 0); table.castShadow = true; this.group.add(table);
        const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 1.2), deskMat); leg1.position.set(-1.4, 0.4, 0); this.group.add(leg1);
        const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 1.2), deskMat); leg2.position.set(1.4, 0.4, 0); this.group.add(leg2);
        const chair = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({color: 0x0f172a})); chair.position.set(0, 0.3, 1.0); this.group.add(chair);

        const canvas = document.getElementById('masterMonitorCanvas'); this.ctx = canvas.getContext('2d'); this.screenTex = new THREE.CanvasTexture(canvas);
        const screen = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.8, 32, 1, true, -Math.PI/8, Math.PI/4), new THREE.MeshBasicMaterial({map: this.screenTex, side: THREE.DoubleSide}));
        screen.position.set(0, 1.3, 1.7); screen.rotation.y = Math.PI; screen.userData.isMasterMonitor = true; this.group.add(screen);

        scene.add(this.group); setInterval(() => this.drawMonitor(), 500); this.bindUI();
    }

    drawMonitor() {
        const grad = this.ctx.createLinearGradient(0, 0, 800, 600); grad.addColorStop(0, '#020617'); grad.addColorStop(1, '#0f172a');
        this.ctx.fillStyle = grad; this.ctx.fillRect(0,0,800,600);
        this.ctx.strokeStyle = 'rgba(255,255,255,0.05)'; this.ctx.lineWidth = 1;
        for(let i=0; i<800; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(i,0); this.ctx.lineTo(i,600); this.ctx.stroke(); }
        for(let i=0; i<600; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(0,i); this.ctx.lineTo(800,i); this.ctx.stroke(); }

        this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(0,0,800,50);
        this.ctx.fillStyle = '#38bdf8'; this.ctx.font = 'bold 24px Arial'; this.ctx.textAlign = 'left'; this.ctx.fillText('DirectorOS', 20, 35);
        this.ctx.fillStyle = '#4ade80'; this.ctx.font = '16px monospace'; this.ctx.textAlign = 'right'; this.ctx.fillText(`Active Specimens: ${window.LabState.inventory.length}`, 780, 32);

        if (this.appState === 'desktop') {
            const drawApp = (x, y, color, title, icon) => {
                this.ctx.fillStyle = 'rgba(30,41,59,0.8)'; this.ctx.fillRect(x, y, 120, 120);
                this.ctx.strokeStyle = color; this.ctx.lineWidth = 2; this.ctx.strokeRect(x, y, 120, 120);
                this.ctx.fillStyle = color; this.ctx.font = '40px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText(icon, x+60, y+65);
                this.ctx.fillStyle = '#fff'; this.ctx.font = '14px Arial'; this.ctx.fillText(title, x+60, y+100);
            };

            drawApp(150, 100, '#3b82f6', 'ACI Prep OS', '1'); drawApp(340, 100, '#eab308', 'Slump OS', '2'); drawApp(530, 100, '#ef4444', 'UTM Server', '3');
            drawApp(150, 260, '#8b5cf6', 'Sieve Plotter', '4'); drawApp(340, 260, '#10b981', 'LA Abrasion', '5'); drawApp(530, 260, '#f97316', 'Oven Data', '6');
            drawApp(150, 420, '#8b5a2b', 'CBR Analysis', '7'); drawApp(340, 420, '#a855f7', 'NDT Suite', '8');
            drawApp(530, 420, '#00ff88', 'Inventory', '📁');
            
        } else if (this.appState === 'inventory_list') {
            this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(20, 70, 760, 500);
            this.ctx.fillStyle = '#38bdf8'; this.ctx.font = 'bold 20px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('LABORATORY BATCH DIRECTORY', 400, 110);
            
            this.ctx.fillStyle = '#ef4444'; this.ctx.fillRect(30, 80, 80, 30);
            this.ctx.fillStyle = '#fff'; this.ctx.font = '14px Arial'; this.ctx.fillText('<- BACK', 70, 100);

            const batches = {};
            window.LabState.inventory.forEach(item => {
                if (!batches[item.batchId]) batches[item.batchId] = { mixName: item.mixName, wc: item.c > 0 ? (item.w/item.c).toFixed(2) : 'N/A', slump: item.slumpMm, count: 0 };
                batches[item.batchId].count++;
            });

            let y = 150;
            this.ctx.fillStyle = '#334155'; this.ctx.fillRect(50, y, 700, 30);
            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 14px Arial'; this.ctx.textAlign = 'left';
            this.ctx.fillText('MIX DESIGN NAME', 70, y+20); this.ctx.fillText('W/C RATIO', 350, y+20); this.ctx.fillText('SLUMP', 450, y+20); this.ctx.fillText('SPECIMENS', 550, y+20);
            
            Object.keys(batches).forEach(bId => {
                y += 40;
                this.ctx.fillStyle = '#0f172a'; this.ctx.fillRect(50, y, 700, 35);
                this.ctx.strokeStyle = '#38bdf8'; this.ctx.strokeRect(50, y, 700, 35);
                this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '14px monospace';
                this.ctx.fillText(batches[bId].mixName, 70, y+22);
                this.ctx.fillText(batches[bId].wc, 350, y+22);
                this.ctx.fillText(`${batches[bId].slump} mm`, 450, y+22);
                this.ctx.fillText(batches[bId].count, 550, y+22);
                this.ctx.fillStyle = '#10b981'; this.ctx.fillRect(660, y+5, 80, 25);
                this.ctx.fillStyle = '#fff'; this.ctx.font = '12px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('VIEW', 700, y+22);
                this.ctx.textAlign = 'left';
            });
            
        } else if (this.appState === 'inventory_detail') {
            this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(20, 70, 760, 500);
            
            this.ctx.fillStyle = '#ef4444'; this.ctx.fillRect(30, 80, 80, 30);
            this.ctx.fillStyle = '#fff'; this.ctx.font = '14px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('<- BACK', 70, 100);

            const specs = window.LabState.inventory.filter(i => i.batchId == this.selectedBatchId);
            const mixName = specs.length > 0 ? specs[0].mixName : "Unknown";

            this.ctx.fillStyle = '#38bdf8'; this.ctx.font = 'bold 20px Arial'; 
            this.ctx.fillText(`DOSSIER: ${mixName.toUpperCase()}`, 400, 110);

            let y = 150;
            this.ctx.fillStyle = '#334155'; this.ctx.fillRect(50, y, 700, 30);
            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 14px Arial'; this.ctx.textAlign = 'left';
            this.ctx.fillText('SPECIMEN ID', 70, y+20); this.ctx.fillText('TYPE', 250, y+20); this.ctx.fillText('AGE TESTED', 400, y+20); this.ctx.fillText('PEAK STRENGTH', 550, y+20);

            specs.forEach((spec, i) => {
                y += 35;
                this.ctx.fillStyle = i % 2 === 0 ? '#0f172a' : '#1e293b'; this.ctx.fillRect(50, y, 700, 35);
                this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '14px monospace';
                this.ctx.fillText(spec.name, 70, y+22);
                this.ctx.fillText(spec.type.toUpperCase(), 250, y+22);
                
                if(spec.tested) {
                    this.ctx.fillStyle = '#f59e0b';
                    this.ctx.fillText(`${spec.age} Days`, 400, y+22);
                    this.ctx.fillStyle = '#4ade80';
                    this.ctx.fillText(`${spec.ultimateStrength.toFixed(2)} MPa`, 550, y+22);
                } else {
                    this.ctx.fillStyle = '#94a3b8';
                    this.ctx.fillText(`Curing (${spec.age}d)`, 400, y+22);
                    this.ctx.fillText(`Pending...`, 550, y+22);
                }
            });
        }
        this.screenTex.needsUpdate = true;
    }

    bindUI() {
        const canvas = document.getElementById('masterMonitorCanvas');
        canvas.addEventListener('click', (e) => {
            if(canvas.style.display !== 'block') return;
            const rect = canvas.getBoundingClientRect(); const x = (e.clientX - rect.left) * (canvas.width / rect.width); const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            
            if(x > 750 && x < 790 && y > 10 && y < 50) { document.getElementById('osContainer').classList.remove('active'); if(!window.isMobileTouch) window.controls.lock(); return; }
            
            if (this.appState === 'desktop') {
                const switchApp = (id) => { canvas.style.display = 'none'; document.getElementById(id).style.display = 'block'; };
                if(x>150&&x<270 && y>100&&y<220) switchApp('prepMonitorCanvas');
                if(x>340&&x<460 && y>100&&y<220) switchApp('slumpMonitorCanvas');
                if(x>530&&x<650 && y>100&&y<220) switchApp('utmMonitorCanvas');
                if(x>150&&x<270 && y>260&&y<380) switchApp('sieveMonitorCanvas');
                if(x>340&&x<460 && y>260&&y<380) switchApp('laMonitorCanvas');
                if(x>530&&x<650 && y>260&&y<380) switchApp('ovenMonitorCanvas');
                if(x>150&&x<270 && y>420&&y<540) switchApp('cbrMonitorCanvas');
                if(x>340&&x<460 && y>420&&y<540) switchApp('ndtMonitorCanvas');
                if(x>530&&x<650 && y>420&&y<540) { this.appState = 'inventory_list'; this.drawMonitor(); }
                
            } else if (this.appState === 'inventory_list') {
                if(x > 30 && x < 110 && y > 80 && y < 110) { this.appState = 'desktop'; this.drawMonitor(); return; } 
                
                const batches = {};
                window.LabState.inventory.forEach(item => { if (!batches[item.batchId]) batches[item.batchId] = true; });
                const batchIds = Object.keys(batches);
                
                let rowY = 150;
                for (let i = 0; i < batchIds.length; i++) {
                    rowY += 40;
                    if(x > 660 && x < 740 && y > rowY + 5 && y < rowY + 30) {
                        this.selectedBatchId = batchIds[i];
                        this.appState = 'inventory_detail';
                        this.drawMonitor();
                        break;
                    }
                }
            } else if (this.appState === 'inventory_detail') {
                if(x > 30 && x < 110 && y > 80 && y < 110) { this.appState = 'inventory_list'; this.drawMonitor(); return; } 
            }
        });
    }
    update(delta) {}
}

class CuringTank {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); this.group.position.set(x, 0, z);
        this.uiID = 'curingUI'; this.uiVisible = false; this.name = "Accelerated Weathering Chamber";
        this.state = { env: 'standard' };
        this.selectedMixId = 'all';

        const frameMat = new THREE.MeshStandardMaterial({color: 0x475569, metalness: 0.8, roughness: 0.4});
        const glassMat = new THREE.MeshStandardMaterial({color: 0x94a3b8, transparent: true, opacity: 0.4, metalness: 0.9, roughness: 0.1});

        const tankBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 1.7), frameMat); tankBase.position.y = 0.1; this.group.add(tankBase);
        const w1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 0.1), glassMat); w1.position.set(0, 0.6, 0.8); this.group.add(w1);
        const w2 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 0.1), glassMat); w2.position.set(0, 0.6, -0.8); this.group.add(w2);
        const w3 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 1.5), glassMat); w3.position.set(1.55, 0.6, 0); this.group.add(w3);
        const w4 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 1.5), glassMat); w4.position.set(-1.55, 0.6, 0); this.group.add(w4);

        this.waterMat = new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, transmission: 0.9, opacity: 0.8, transparent: true });
        this.water = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.75, 1.5), this.waterMat); this.water.position.y = 0.55; this.group.add(this.water);

        const hitbox = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 1.9), new THREE.MeshBasicMaterial({visible:false}));
        hitbox.position.y = 0.6; hitbox.userData.isCuringTank = true; this.group.add(hitbox);

        this.osState = 'desktop';
        const deskMat = new THREE.MeshStandardMaterial({color: 0x1e293b});
        const desk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.6), deskMat); desk.position.set(-2.0, 0.4, 0); desk.castShadow = true; this.group.add(desk);
        
        const monitorGroup = new THREE.Group(); monitorGroup.position.set(-2.0, 1.25, 0); monitorGroup.rotation.y = Math.PI / 2; this.group.add(monitorGroup);
        const screenBox = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.05), new THREE.MeshPhysicalMaterial({color: 0x111111})); monitorGroup.add(screenBox);
        
        const canvas = document.getElementById('curingMonitorCanvas'); this.ctx = canvas.getContext('2d'); this.screenTex = new THREE.CanvasTexture(canvas);
        const display = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.6), new THREE.MeshBasicMaterial({map: this.screenTex})); display.position.z = 0.026; display.userData.isCuringMonitor = true; monitorGroup.add(display);

        this.cylindersInTank = []; scene.add(this.group);
        this.injectWeatheringUI();
        this.bindUI();

        setInterval(() => { this.drawMonitor(this.osState === 'software'); }, 500);
        window.addEventListener('inventoryUpdate', () => this.updateDropdown());
    }

    injectWeatheringUI() {
        const curingUI = document.getElementById('curingUI');
        if(curingUI && !document.getElementById('envSelect')) {
            const grp = document.createElement('div');
            grp.className = 'control-group'; grp.style.width = '100%';
            grp.innerHTML = `<label class="label">Exposure Environment</label><select id="envSelect" style="margin-bottom: 10px;"><option value="standard">Standard Moist Curing</option><option value="nacl">Harsh Marine Exposure</option></select>`;
            curingUI.insertBefore(grp, curingUI.firstChild);

            document.getElementById('envSelect').onchange = (e) => {
                this.state.env = e.target.value;
                this.waterMat.color.setHex(this.state.env === 'nacl' ? 0x64748b : 0x0ea5e9);
            };
        }
    }

    generateRustTexture(severity) {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#64748b'; ctx.fillRect(0,0,512,512);

        for(let i=0; i<15000; i++) {
            let x = Math.random()*512; let y = Math.random()*512;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
            ctx.fillRect(x,y,2,2);
            if (Math.random() < severity) {
                ctx.fillStyle = `rgba(${100+Math.random()*100}, ${30+Math.random()*30}, 10, ${Math.random()*0.8})`;
                ctx.beginPath(); ctx.arc(x, y, Math.random()*20, 0, Math.PI*2); ctx.fill();
            }
        }
        return new THREE.CanvasTexture(canvas);
    }

    updateDropdown() {
        const select = document.getElementById('curingSpecSelect');
        if(!select) return;
        select.innerHTML = '<option value="all">Age ALL Specimens</option>';
        this.cylindersInTank.forEach(mesh => {
            const mix = mesh.userData.mixData;
            if(!mix.tested && mix.type !== 'steel' && !mix.id.toString().startsWith('std_')) {
                const opt = document.createElement('option');
                opt.value = mix.id; 
                opt.text = `${mix.name} (Age: ${mix.age}d)`;
                select.appendChild(opt);
            }
        });
    }

    drawMonitor(isSoftware = false) {
        if (!isSoftware) {
            const grad = this.ctx.createLinearGradient(0, 0, 800, 600); grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#1e3a8a');
            this.ctx.fillStyle = grad; this.ctx.fillRect(0,0,800,600);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; this.ctx.fillRect(30, 30, 80, 80);
            this.ctx.fillStyle = '#38bdf8'; this.ctx.font = '40px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('💧', 70, 85);
            this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '12px Arial'; this.ctx.fillText('Curing_OS', 70, 130);
            this.screenTex.needsUpdate = true; return;
        }

        this.ctx.fillStyle = '#d4d0c8'; this.ctx.fillRect(0,0,800,600);
        this.ctx.fillStyle = '#000080'; this.ctx.fillRect(0,0,800,40);
        this.ctx.fillStyle = '#ffffff'; this.ctx.font = 'bold 18px Arial'; this.ctx.textAlign='left';
        this.ctx.fillText('ASTM C511 Environmental Control System', 15, 26);

        this.ctx.fillStyle = '#ffffff'; this.ctx.fillRect(20, 60, 380, 520);
        this.ctx.strokeStyle = '#808080'; this.ctx.lineWidth = 2; this.ctx.strokeRect(20, 60, 380, 520);
        this.ctx.fillStyle = '#000080'; this.ctx.fillRect(22, 62, 376, 35);
        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px Arial'; this.ctx.textAlign = 'center';
        this.ctx.fillText(`TANK INVENTORY`, 210, 85);

        this.ctx.fillStyle = '#ffffff'; this.ctx.fillRect(420, 60, 360, 520);
        this.ctx.strokeRect(420, 60, 360, 520);
        this.ctx.fillStyle = '#000080'; this.ctx.fillRect(422, 62, 356, 35);
        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px Arial'; 
        this.ctx.fillText(`AGE ACCELERATOR`, 600, 85);

        let rowY = 120;
        
        this.ctx.fillStyle = this.selectedMixId === 'all' ? '#000080' : '#e0e0e0'; this.ctx.fillRect(30, rowY, 360, 30);
        this.ctx.fillStyle = this.selectedMixId === 'all' ? '#ffffff' : '#000000'; this.ctx.font = 'bold 14px monospace'; this.ctx.textAlign = 'left';
        this.ctx.fillText(`► ACCELERATE ALL SPECIMENS`, 40, rowY + 20);

        const items = this.cylindersInTank.filter(m => !m.userData.mixData.tested);
        items.forEach((mesh) => {
            rowY += 35;
            const mix = mesh.userData.mixData;
            this.ctx.fillStyle = this.selectedMixId === mix.id ? '#000080' : '#f0f0f0'; this.ctx.fillRect(30, rowY, 360, 30);
            this.ctx.fillStyle = this.selectedMixId === mix.id ? '#ffffff' : '#000000';
            this.ctx.fillText(`${mix.name.substring(0, 20)} | Age: ${mix.age}d`, 40, rowY + 20);
        });

        const drawBtn = (y, color, text) => {
            this.ctx.fillStyle = '#c0c0c0'; this.ctx.fillRect(450, y, 300, 50);
            this.ctx.strokeStyle = '#808080'; this.ctx.strokeRect(450, y, 300, 50);
            this.ctx.fillStyle = color; this.ctx.fillRect(455, y+5, 290, 40);
            this.ctx.fillStyle = '#ffffff'; this.ctx.font = 'bold 20px Arial'; this.ctx.textAlign = 'center';
            this.ctx.fillText(text, 600, y + 32);
        }

        this.ctx.fillStyle = '#000'; this.ctx.font = '16px Arial'; this.ctx.textAlign = 'center';
        this.ctx.fillText(`Selected: ${this.selectedMixId === 'all' ? 'EVERYTHING' : 'SPECIFIC ITEM'}`, 600, 150);

        drawBtn(200, '#3b82f6', 'ADVANCE +3 DAYS');
        drawBtn(270, '#2563eb', 'ADVANCE +7 DAYS');
        drawBtn(340, '#1d4ed8', 'ADVANCE +28 DAYS');

        this.screenTex.needsUpdate = true;
    }

    cureTarget(days, targetId) {
        let agedCount = 0;
        this.cylindersInTank.forEach(mesh => {
            let mix = mesh.userData.mixData;
            if(!mix.tested && mix.type !== 'steel' && mix.testType !== 'tensile' && (targetId === 'all' || mix.id === targetId)) {
                mix.age += days;
                const maturity = mix.age / (4.0 + 0.85 * mix.age);
                mix.currentFc = (mix.targetFc || 30) * maturity;

                if (this.state.env === 'nacl') { mix.corrosionLevel = (mix.corrosionLevel || 0) + (days * 0.015); }
                if (mix.corrosionLevel > 0.2) {
                    mesh.material = new THREE.MeshStandardMaterial({ map: this.generateRustTexture(mix.corrosionLevel), roughness: 1.0 });
                }
                
                if(!mix.curingNotes) mix.curingNotes = [];
                mix.curingNotes.push(`I've been curing this sample for another ${days} days in ${this.state.env === 'nacl' ? 'Harsh Marine' : 'Standard Moist'} environment. It is now ${mix.age} days old.`);
                
                agedCount++;
            }
        });

        alert(`Successfully aged ${agedCount} specimen(s) by ${days} days.`);
        window.dispatchEvent(new Event('inventoryUpdate'));
        this.updateDropdown();
        this.drawMonitor(true);
    }

    bindUI() {
        const cure = (days) => {
            const select = document.getElementById('curingSpecSelect');
            const targetId = select ? select.value : 'all';
            this.cureTarget(days, targetId);
        };
        document.getElementById('cure3Btn').onclick = () => cure(3);
        document.getElementById('cure7Btn').onclick = () => cure(7);
        document.getElementById('cure28Btn').onclick = () => cure(28);

        const canvas = document.getElementById('curingMonitorCanvas');
        canvas.addEventListener('dblclick', (e) => {
            if(canvas.style.display !== 'block') return;
            if (this.osState === 'desktop') { this.osState = 'software'; this.drawMonitor(true); }
        });
        
        canvas.addEventListener('click', (e) => {
            if(canvas.style.display !== 'block') return;
            const rect = canvas.getBoundingClientRect(); const x = (e.clientX - rect.left) * (canvas.width / rect.width); const y = (e.clientY - rect.top) * (canvas.height / rect.height);

            if (this.osState === 'software') {
                if(x > 760 && x < 800 && y > 0 && y < 40) { this.osState = 'desktop'; this.drawMonitor(false); return; }

                let rowY = 120;
                const items = this.cylindersInTank.filter(m => !m.userData.mixData.tested);
                
                if (x > 30 && x < 390 && y > rowY && y < rowY + 30) {
                    this.selectedMixId = 'all'; this.drawMonitor(true);
                }
                items.forEach(mesh => {
                    rowY += 35;
                    if (x > 30 && x < 390 && y > rowY && y < rowY + 30) {
                        this.selectedMixId = mesh.userData.mixData.id;
                        this.drawMonitor(true);
                    }
                });

                if (x > 450 && x < 750) {
                    if (y > 200 && y < 250) this.cureTarget(3, this.selectedMixId);
                    if (y > 270 && y < 320) this.cureTarget(7, this.selectedMixId);
                    if (y > 340 && y < 390) this.cureTarget(28, this.selectedMixId);
                }
            }
        });
    }
    update(delta) {}
}

const masterObj = new MasterDesk(scene, 0, -8);
const ovenObj = new OvenStation(scene, -6, -8);
const ndtObj = new NDTStation(scene, 6, -8);

const prepObj = new PrepStation(scene, -12, -2); prepObj.group.rotation.y = Math.PI / 2;
const curingObj = new CuringTank(scene, -12, 8); curingObj.group.rotation.y = Math.PI;
const sieveObj = new SieveStation(scene, -5, 8); sieveObj.group.rotation.y = Math.PI;
const laObj = new LAStation(scene, 2, 8); laObj.group.rotation.y = Math.PI;
const cbrObj = new CBRStation(scene, 9, 8); cbrObj.group.rotation.y = Math.PI;
const utmObj = new UTMStation(scene, 13, 4); utmObj.group.rotation.y = -Math.PI / 2;
const slumpObj = new SlumpStation(scene, 13, -3); slumpObj.group.rotation.y = -Math.PI / 2;

const stations = [
    { id: 'master', name: "Director Desk", obj: masterObj },
    { id: 'curing', name: 'Curing Room', obj: curingObj },
    { id: 'prep', name: 'Sample Preparation', obj: prepObj },
    { id: 'oven', name: 'Oven', obj: ovenObj },
    { id: 'sieve', name: 'Sieve', obj: sieveObj },
    { id: 'la', name: 'LA Abrasion', obj: laObj },
    { id: 'cbr', name: 'CBR Test', obj: cbrObj },
    { id: 'utm', name: 'UTM Testing', obj: utmObj },
    { id: 'slump', name: 'Slump Test', obj: slumpObj },
    { id: 'ndt', name: 'NDT Station', obj: ndtObj }
];

scene.traverse((obj) => {
    if (obj.isMesh && obj.userData) {
        const isMonitorScreen = Object.keys(obj.userData).some(k => k.endsWith('Monitor'));
        if (isMonitorScreen && obj.geometry.type === 'PlaneGeometry' && !obj.userData.isNDTMonitor && !obj.userData.isMasterMonitor && !obj.userData.isCuringMonitor) {
            const width = obj.geometry.parameters.width; const height = obj.geometry.parameters.height;
            const monitorGroup = new THREE.Group();
            monitorGroup.position.copy(obj.position); monitorGroup.rotation.copy(obj.rotation);
            const plasticMat = new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.8});

            const bezel = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.05), plasticMat);
            bezel.position.z = -0.026; bezel.castShadow = true; monitorGroup.add(bezel);

            const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.3), plasticMat);
            neck.position.set(0, -height/2 - 0.1, -0.05); neck.castShadow = true; monitorGroup.add(neck);

            const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.25), plasticMat);
            base.position.set(0, -height/2 - 0.25, -0.05); base.castShadow = true; monitorGroup.add(base);

            obj.parent.add(monitorGroup);
        }
    }
});

window.controls = new THREE.PointerLockControls(camera, document.body);
window.currentStation = null;

if (window.isMobileTouch) {
    document.getElementById('pcInstructions').style.display = 'none';
    document.getElementById('enterBtn').textContent = "TAP TO ENTER LAB";
}

document.getElementById('enterBtn').addEventListener('click', () => {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('labHeader').style.display = 'flex';
    document.getElementById('statusPanel').style.display = 'block';
    window.gameActive = true;
    if(window.isMobileTouch) {
        document.getElementById('mobileControls').style.display = 'block';
        document.getElementById('uiInstruction').style.display = 'none';
        document.getElementById('crosshair').style.display = 'block';
    } else {
        window.controls.lock();
    }
});

document.getElementById('canvasContainer').addEventListener('click', () => {
    if (!window.isMobileTouch && !window.controls.isLocked && window.gameActive && !document.getElementById('osContainer').classList.contains('active') && document.getElementById('labTablet').style.display !== 'flex' && document.getElementById('labNotebook').style.display !== 'block') {
        window.controls.lock();
    }
});

window.controls.addEventListener('lock', () => { document.getElementById('uiInstruction').style.display = 'block'; document.getElementById('labTablet').style.display = 'none'; document.getElementById('labNotebook').style.display = 'none'; });
window.controls.addEventListener('unlock', () => { document.getElementById('crosshair').className = ''; document.getElementById('uiInstruction').style.display = 'none'; });

let isSprinting = false; let isCrouching = false; let isInspecting = false;
let moveF = false, moveB = false, moveL = false, moveR = false;
let autoPanLeft = false; 
const raycaster = new THREE.Raycaster();
let lastTabPress = 0;

function handleInteract() {
    if(!window.gameActive) return;
    if(!window.isMobileTouch && !window.controls.isLocked) return;

    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    if(intersects.length > 0) {
        const hit = intersects[0].object;
        if(hit.userData.isGrabbableCylinder) {
            if(window.LabState.handItem) return;
            hit.parent.remove(hit); hit.position.set(0,0,0); hit.rotation.set(0,0,0); playerHand.add(hit); window.LabState.handItem = hit;
            document.getElementById('handDisplay').textContent = hit.userData.mixData.name; document.getElementById('handDisplay').style.color = '#4ade80';
        }
        else if(hit.userData.isCuringTank && window.LabState.handItem && window.LabState.handItem.userData.isGrabbableCylinder) {
            const item = window.LabState.handItem; playerHand.remove(item); const tankObj = stations.find(s => s.id === 'curing').obj;
            item.position.set((Math.random()-0.5)*2, 0.4, (Math.random()-0.5)*1); tankObj.group.add(item); tankObj.cylindersInTank.push(item);
            window.LabState.handItem = null; document.getElementById('handDisplay').textContent = 'Empty'; document.getElementById('handDisplay').style.color = '#f59e0b';
            window.dispatchEvent(new Event('inventoryUpdate')); 
        }
        else if(hit.userData.isUTMLoader && window.LabState.handItem && window.LabState.handItem.userData.isGrabbableCylinder) {
            const item = window.LabState.handItem; const utm = stations.find(s => s.id === 'utm').obj; 
            
            if (utm.testState.status !== 'IDLE' && utm.testMesh) {
                alert("UTM is currently occupied! Please reset the machine first.");
                return;
            }
            
            utm.loadSpecimenFromHand(item.userData.mixData);
            playerHand.remove(item); window.LabState.handItem = null; document.getElementById('handDisplay').textContent = 'Empty'; document.getElementById('handDisplay').style.color = '#f59e0b';
        }
        else if(hit.userData.isOvenLoader && window.LabState.handItem && window.LabState.handItem.userData.isGrabbableCylinder) {
            const item = window.LabState.handItem; const oven = stations.find(s => s.id === 'oven').obj;
            if(oven.loadSpecimenFromHand(item.userData.mixData)) {
                playerHand.remove(item); window.LabState.handItem = null; document.getElementById('handDisplay').textContent = 'Empty'; document.getElementById('handDisplay').style.color = '#f59e0b';
            }
        }
    }
}

function handleTabletToggle(isDoubleTap = false) {
    if(!window.gameActive || !window.currentStation) return;
    const tablet = document.getElementById('labTablet');

    if (tablet.style.display !== 'flex') {
        if(!window.isMobileTouch) window.controls.unlock();
        tablet.style.display = 'flex';
        tablet.classList.remove('full-screen');
        document.querySelectorAll('.station-ui').forEach(el => el.style.display = 'none');
        document.getElementById(window.currentStation.id + 'UI').style.display = 'flex';
        document.getElementById('tabletTitle').textContent = window.currentStation.name;
    } else {
        if (isDoubleTap) {
            tablet.classList.toggle('full-screen');
        } else {
            tablet.style.display = 'none';
            tablet.classList.remove('full-screen');
            if(!window.isMobileTouch && !document.getElementById('osContainer').classList.contains('active')) {
                window.controls.lock();
            }
        }
    }
}

function handleMonitorClick() {
    if(!window.gameActive) return;
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    if(intersects.length > 0) {
        const hit = intersects[0].object;
        const allMonitors = ['masterMonitorCanvas', 'sieveMonitorCanvas', 'utmMonitorCanvas', 'slumpMonitorCanvas', 'prepMonitorCanvas', 'laMonitorCanvas', 'ovenMonitorCanvas', 'cbrMonitorCanvas', 'ndtMonitorCanvas', 'curingMonitorCanvas'];
        let matched = false;
        if(hit.userData.isMasterMonitor) matched = 'masterMonitorCanvas';
        else if(hit.userData.isSieveMonitor) matched = 'sieveMonitorCanvas';
        else if(hit.userData.isUTMMonitor) matched = 'utmMonitorCanvas';
        else if(hit.userData.isSlumpMonitor) matched = 'slumpMonitorCanvas';
        else if(hit.userData.isPrepMonitor) matched = 'prepMonitorCanvas';
        else if(hit.userData.isLAMonitor) matched = 'laMonitorCanvas';
        else if(hit.userData.isOvenMonitor) matched = 'ovenMonitorCanvas';
        else if(hit.userData.isCBRMonitor) matched = 'cbrMonitorCanvas';
        else if(hit.userData.isNDTMonitor) matched = 'ndtMonitorCanvas';
        else if(hit.userData.isCuringMonitor) matched = 'curingMonitorCanvas';

        if (matched) {
            document.getElementById('osContainer').classList.add('active');
            allMonitors.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = (id === matched) ? 'block' : 'none'; });
            if(!window.isMobileTouch) window.controls.unlock();
        }
    }
}

document.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if(e.code === 'KeyW') moveF = true; if(e.code === 'KeyS') moveB = true;
    if(e.code === 'KeyA') moveL = true; if(e.code === 'KeyD') moveR = true;
    if(e.code === 'ShiftLeft') isSprinting = true;
    if(e.code === 'KeyC') isCrouching = !isCrouching;
    if(e.code === 'KeyE') handleInteract();
    if(e.code === 'KeyQ') autoPanLeft = !autoPanLeft; 
    if(e.code === 'KeyN') { e.preventDefault(); window.toggleNotebook(); }
    if(e.code === 'Tab' || e.code === 'Escape') {
        e.preventDefault();
        const now = Date.now();
        if(e.code === 'Escape') handleTabletToggle(false);
        else handleTabletToggle(now - lastTabPress < 300);
        lastTabPress = now;
    }
});

document.addEventListener('keyup', (e) => {
    if(e.code === 'KeyW') moveF = false; if(e.code === 'KeyS') moveB = false;
    if(e.code === 'KeyA') moveL = false; if(e.code === 'KeyD') moveR = false;
    if(e.code === 'ShiftLeft') isSprinting = false;
});

document.addEventListener('mousedown', (e) => {
    if(e.button === 2 && !window.isMobileTouch && window.controls.isLocked && window.LabState.handItem) {
        isInspecting = true; window.controls.unlock();
        document.getElementById('uiInstruction').textContent = "Drag mouse to rotate specimen"; document.getElementById('uiInstruction').style.display = 'block';
        gsap.to(playerHand.position, {x: 0, y: 0, z: -0.5, duration: 0.3});
    }
});
document.addEventListener('mouseup', (e) => {
    if(e.button === 2 && isInspecting) {
        isInspecting = false; window.controls.lock();
        gsap.to(playerHand.position, {x: 0.3, y: -0.2, z: -0.6, duration: 0.3}); gsap.to(playerHand.rotation, {x: 0, y: 0, duration: 0.3});
    }
});
document.addEventListener('mousemove', (e) => {
    if(isInspecting && window.LabState.handItem && !window.isMobileTouch) { playerHand.rotation.y += e.movementX * 0.01; playerHand.rotation.x += e.movementY * 0.01; }
});
document.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('dblclick', (e) => { if(!window.isMobileTouch && window.controls.isLocked) handleMonitorClick(); });

let joyMoveX = 0, joyMoveZ = 0;
let joyTouchId = null, lookTouchId = null;
let joyStartX = 0, joyStartY = 0;
let prevLookX = 0, prevLookY = 0;
let lastLookTap = 0;

const joyBase = document.getElementById('joystickBase');
const joyKnob = document.getElementById('joystickKnob');
const joyMaxRadius = 40;

document.getElementById('joystickZone').addEventListener('touchstart', (e) => {
    e.preventDefault(); const touch = e.changedTouches[0]; joyTouchId = touch.identifier;
    joyBase.style.left = (touch.clientX - 50) + 'px'; joyBase.style.top = (touch.clientY - 50) + 'px'; joyBase.style.display = 'block';
    joyStartX = touch.clientX; joyStartY = touch.clientY;
}, {passive: false});

document.getElementById('joystickZone').addEventListener('touchmove', (e) => {
    e.preventDefault();
    for(let i=0; i<e.changedTouches.length; i++) {
        if(e.changedTouches[i].identifier === joyTouchId) {
            const touch = e.changedTouches[i];
            let dx = touch.clientX - joyStartX; let dy = touch.clientY - joyStartY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > joyMaxRadius) { dx = (dx/dist)*joyMaxRadius; dy = (dy/dist)*joyMaxRadius; }
            joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
            joyMoveX = dx / joyMaxRadius; joyMoveZ = dy / joyMaxRadius;
        }
    }
}, {passive: false});

document.getElementById('joystickZone').addEventListener('touchend', (e) => {
    e.preventDefault();
    for(let i=0; i<e.changedTouches.length; i++) {
        if(e.changedTouches[i].identifier === joyTouchId) {
            joyTouchId = null; joyBase.style.display = 'none'; joyKnob.style.transform = `translate(0px, 0px)`;
            joyMoveX = 0; joyMoveZ = 0;
        }
    }
});

document.getElementById('lookZone').addEventListener('touchstart', (e) => {
    e.preventDefault(); const touch = e.changedTouches[0]; lookTouchId = touch.identifier;
    prevLookX = touch.clientX; prevLookY = touch.clientY;
}, {passive: false});

document.getElementById('lookZone').addEventListener('touchmove', (e) => {
    e.preventDefault();
    for(let i=0; i<e.changedTouches.length; i++) {
        if(e.changedTouches[i].identifier === lookTouchId) {
            const touch = e.changedTouches[i];
            const dx = touch.clientX - prevLookX; const dy = touch.clientY - prevLookY;

            if(isInspecting && window.LabState.handItem) {
                playerHand.rotation.y += dx * 0.01; playerHand.rotation.x += dy * 0.01;
            } else {
                const euler = new THREE.Euler(0, 0, 0, 'YXZ');
                euler.setFromQuaternion(camera.quaternion);
                euler.y -= dx * 0.005; euler.x -= dy * 0.005;
                euler.x = Math.max( - Math.PI / 2, Math.min( Math.PI / 2, euler.x ) );
                camera.quaternion.setFromEuler(euler);
            }
            prevLookX = touch.clientX; prevLookY = touch.clientY;
        }
    }
}, {passive: false});

document.getElementById('lookZone').addEventListener('touchend', (e) => {
    e.preventDefault();
    for(let i=0; i<e.changedTouches.length; i++) {
        if(e.changedTouches[i].identifier === lookTouchId) {
            lookTouchId = null;
            const now = Date.now();
            if(now - lastLookTap < 300) { handleMonitorClick(); }
            lastLookTap = now;
        }
    }
});

document.getElementById('mobInteract').addEventListener('touchstart', (e) => { e.preventDefault(); handleInteract(); });
document.getElementById('mobTablet').addEventListener('touchstart', (e) => {
    e.preventDefault();
    const now = Date.now(); handleTabletToggle(now - lastTabPress < 300); lastTabPress = now;
});
document.getElementById('mobSprint').addEventListener('touchstart', (e) => { e.preventDefault(); isSprinting = !isSprinting; e.target.classList.toggle('active-toggle'); });
document.getElementById('mobCrouch').addEventListener('touchstart', (e) => { e.preventDefault(); isCrouching = !isCrouching; e.target.classList.toggle('active-toggle'); });
document.getElementById('mobInspect').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if(!window.LabState.handItem) return;
    isInspecting = !isInspecting;
    e.target.classList.toggle('active-toggle');
    if(isInspecting) { gsap.to(playerHand.position, {x: 0, y: 0, z: -0.5, duration: 0.3}); }
    else { gsap.to(playerHand.position, {x: 0.3, y: -0.2, z: -0.6, duration: 0.3}); gsap.to(playerHand.rotation, {x: 0, y: 0, duration: 0.3}); }
});

document.getElementById('closeTabletBtn').addEventListener('click', () => {
    const tablet = document.getElementById('labTablet'); tablet.style.display = 'none'; tablet.classList.remove('full-screen');
    if(!document.getElementById('osContainer').classList.contains('active')) { if(!window.isMobileTouch) window.controls.lock(); }
});
document.getElementById('closeOSBtn').addEventListener('click', () => {
    const masterCanvas = document.getElementById('masterMonitorCanvas');
    if (masterCanvas.style.display === 'none' && window.currentStation && window.currentStation.id === 'master') {
        const allMonitors = ['sieveMonitorCanvas', 'utmMonitorCanvas', 'slumpMonitorCanvas', 'prepMonitorCanvas', 'laMonitorCanvas', 'ovenMonitorCanvas', 'cbrMonitorCanvas', 'ndtMonitorCanvas', 'curingMonitorCanvas'];
        allMonitors.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
        masterCanvas.style.display = 'block';
    } else {
        document.getElementById('osContainer').classList.remove('active'); if(!window.isMobileTouch) window.controls.lock();
    }
});
window.addEventListener('inventoryUpdate', () => {
    const invDisplay = document.getElementById('invDisplay');
    if(invDisplay) {
        invDisplay.textContent = `${window.LabState.inventory.length} Mixes`;
        invDisplay.style.color = window.LabState.inventory.length > 0 ? '#4ade80' : '#f59e0b';
    }
});

const clock = new THREE.Clock();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const activeStationText = document.getElementById('activeStation');

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    exhaustFans.forEach(fan => {
        fan.rotation.z += 1.5 * delta; 
    });

    const tabletOpen = document.getElementById('labTablet').style.display === 'flex';
    const osOpen = document.getElementById('osContainer').classList.contains('active');
    const nbOpen = document.getElementById('labNotebook').style.display === 'block';
    const canMove = window.gameActive && !isInspecting && !tabletOpen && !osOpen && !nbOpen && (window.controls.isLocked || window.isMobileTouch);

    if (canMove) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        let dz = Number(moveF) - Number(moveB) - joyMoveZ;
        let dx = Number(moveR) - Number(moveL) + joyMoveX;
        direction.z = dz; direction.x = dx; direction.normalize();

        const moveSpeed = isSprinting ? 80.0 : 40.0;
        if (moveF || moveB || Math.abs(joyMoveZ) > 0.1) velocity.z -= direction.z * moveSpeed * delta;
        if (moveL || moveR || Math.abs(joyMoveX) > 0.1) velocity.x -= direction.x * moveSpeed * delta;

        if (camera.position.x < -14) camera.position.x = -14; if (camera.position.x > 14) camera.position.x = 14;
        if (camera.position.z < -9) camera.position.z = -9; if (camera.position.z > 9) camera.position.z = 9;

        if(window.isMobileTouch) {
            camera.translateX(-velocity.x * delta);
            camera.translateZ(velocity.z * delta);
        } else {
            window.controls.moveRight(-velocity.x * delta);
            window.controls.moveForward(-velocity.z * delta);
        }

        const targetY = isCrouching ? 0.8 : 1.6;
        camera.position.y += (targetY - camera.position.y) * 0.1;
        
        if (autoPanLeft) {
            camera.rotation.y += 0.15 * delta;
        }
    }

    if (canMove) {
        raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        const ch = document.getElementById('crosshair');
        if(window.isMobileTouch) ch.style.display = 'block';

        if (intersects.length > 0 && intersects[0].distance < 3) {
            const obj = intersects[0].object;
            if(obj.userData.isGrabbableCylinder) {
                ch.className = 'grab'; document.getElementById('uiInstruction').textContent = "Pick Up"; document.getElementById('uiInstruction').style.display = 'block';
            } else if(obj.userData.isCuringTank && window.LabState.handItem) {
                ch.className = 'interact'; document.getElementById('uiInstruction').textContent = "Place in Tank"; document.getElementById('uiInstruction').style.display = 'block';
            } else if(obj.userData.isUTMLoader && window.LabState.handItem) {
                ch.className = 'interact'; document.getElementById('uiInstruction').textContent = "Load UTM"; document.getElementById('uiInstruction').style.display = 'block';
            } else if(obj.userData.isOvenLoader && window.LabState.handItem) {
                ch.className = 'interact'; document.getElementById('uiInstruction').textContent = "Load Oven"; document.getElementById('uiInstruction').style.display = 'block';
            } else if (obj.userData.isPrepBowl) {
                ch.className = 'interact'; document.getElementById('uiInstruction').textContent = "Mix"; document.getElementById('uiInstruction').style.display = 'block';
            } else {
                ch.className = ''; document.getElementById('uiInstruction').style.display = 'none';
            }
        } else { ch.className = ''; document.getElementById('uiInstruction').style.display = 'none'; }
    }

    let nearestStation = null; let minDistance = 4.0;
    stations.forEach(data => {
        const station = data.obj; if(station.update) station.update(delta);
        const dist = camera.position.distanceTo(station.group.position);
        if (dist < minDistance) { minDistance = dist; nearestStation = data; }
    });
    window.currentStation = nearestStation;
    if(nearestStation && canMove && document.getElementById('crosshair').className === '') {
        document.getElementById('uiInstruction').textContent = window.isMobileTouch ? "Tap to open Tablet" : "Press TAB for Tablet";
        document.getElementById('uiInstruction').style.display = 'block';
        activeStationText.textContent = nearestStation.name;
    }

    renderer.render(scene, camera);
}
animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

window.exportPDFReport = function(canvasId, filename) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [800, 600] });
    const canvas = document.getElementById(canvasId); const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, 800, 600); doc.save(`${filename}.pdf`);
};