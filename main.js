window.LabState = { inventory: [], handItem: null, timeDays: 0 };
window.LabInventory = { mixes: window.LabState.inventory };

// --- MOBILE DETECTION ---
window.isMobileTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
window.gameActive = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf8fafc); 
scene.fog = new THREE.FogExp2(0xf8fafc, 0.02);

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
renderer.toneMappingExposure = 1.2;
document.getElementById('canvasContainer').appendChild(renderer.domElement);

function generateLabFloor() {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d'); 
    ctx.fillStyle = '#64748b'; ctx.fillRect(0,0,1024,1024); 
    for(let i=0; i<50000; i++) { ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)'; ctx.fillRect(Math.random()*1024, Math.random()*1024, 2, 2); }
    ctx.strokeStyle = '#eab308'; ctx.lineWidth = 12; ctx.strokeRect(60, 60, 904, 904);
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 2); return tex;
}

function generateLabWall() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,512,512); 
    ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 300, 512, 212); 
    ctx.fillStyle = '#eab308'; ctx.fillRect(0, 290, 512, 10); 
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 2;
    for(let y=0; y<512; y+=32) {
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(512,y); ctx.stroke();
        for(let x=0; x<512; x+=64) { ctx.beginPath(); ctx.moveTo(x + (y%64===0?32:0), y); ctx.lineTo(x + (y%64===0?32:0), y+32); ctx.stroke(); }
    }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10, 2); return tex;
}

scene.add(new THREE.AmbientLight(0xffffff, 0.4)); 
const overheadLight = new THREE.PointLight(0xfff5e6, 0.5, 60); 
overheadLight.position.set(0, 5, 0); overheadLight.castShadow = true; overheadLight.shadow.bias = -0.001;
scene.add(overheadLight);

const floorMat = new THREE.MeshPhysicalMaterial({ map: generateLabFloor(), roughness: 0.1, metalness: 0.2, clearcoat: 0.8 });
const wallMat = new THREE.MeshStandardMaterial({ map: generateLabWall(), roughness: 0.9 });
const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 1.0 });

const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), ceilMat); ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 6; scene.add(ceiling);
const wallN = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 0.5), wallMat); wallN.position.set(0, 3, -10.25); scene.add(wallN);
const wallS = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 0.5), wallMat); wallS.position.set(0, 3, 10.25); scene.add(wallS);
const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 20), wallMat); wallE.position.set(15.25, 3, 0); scene.add(wallE);
const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 20), wallMat); wallW.position.set(-15.25, 3, 0); scene.add(wallW);

const pillarMat = new THREE.MeshStandardMaterial({color: 0x0f172a, metalness: 0.6, roughness: 0.4});
[[-14.8, -9.8], [14.8, -9.8], [-14.8, 9.8], [14.8, 9.8], [0, -9.8], [0, 9.8], [-14.8, 0], [14.8, 0]].forEach(pos => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), pillarMat); pillar.position.set(pos[0], 3, pos[1]); pillar.castShadow = true; scene.add(pillar);
});

function createPremiumWhiteboard(title, text) {
    const group = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });
    const frameGeom = new THREE.BoxGeometry(2.1, 1.4, 0.05);
    const frame = new THREE.Mesh(frameGeom, frameMat);
    frame.castShadow = true; group.add(frame);

    const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 2048, 1024);
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2;
    for(let i = 0; i < 2048; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke(); }
    for(let i = 0; i < 1024; i += 64) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(2048, i); ctx.stroke(); }

    ctx.fillStyle = '#0284c7'; ctx.fillRect(0, 0, 2048, 160);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 90px Space Grotesk, Arial'; ctx.textAlign = 'center'; 
    ctx.fillText(title.toUpperCase(), 1024, 110);

    ctx.fillStyle = '#0f172a'; ctx.textAlign = 'left';
    const lines = text.split('\n'); let y = 280;
    lines.forEach(line => {
        if(line.includes('ASTM') || line.includes('ACI')) { ctx.font = 'bold 64px JetBrains Mono, monospace'; ctx.fillStyle = '#0369a1'; } 
        else { ctx.font = 'bold 52px JetBrains Mono, monospace'; ctx.fillStyle = '#1e293b'; }
        ctx.fillText(line, 100, y); y += 90;
    });

    ctx.fillStyle = '#94a3b8'; ctx.font = 'italic 40px Space Grotesk, Arial'; ctx.textAlign = 'right'; 
    ctx.fillText('ACI HU Chapter // Virtual Building Material Lab', 1980, 980);

    const tex = new THREE.CanvasTexture(canvas); 
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); 
    const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.1 });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.3), boardMat);
    board.position.z = 0.026; group.add(board);
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

class MasterDesk {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); this.group.position.set(x, 0, z);
        this.uiID = 'masterUI'; this.uiVisible = false; this.name = "Lab Director Desk";
        
        const deskMat = new THREE.MeshStandardMaterial({color: 0x1e293b, roughness: 0.6});
        const table = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.05, 1.5), deskMat); table.position.set(0, 0.8, 0); table.castShadow = true; this.group.add(table);
        const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 1.2), deskMat); leg1.position.set(-1.4, 0.4, 0); this.group.add(leg1);
        const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 1.2), deskMat); leg2.position.set(1.4, 0.4, 0); this.group.add(leg2);
        const chair = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({color: 0x0f172a})); chair.position.set(0, 0.3, 1.0); this.group.add(chair);

        const canvas = document.getElementById('masterMonitorCanvas'); this.ctx = canvas.getContext('2d'); this.screenTex = new THREE.CanvasTexture(canvas);
        const screen = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.8, 32, 1, true, -Math.PI/8, Math.PI/4), new THREE.MeshBasicMaterial({map: this.screenTex, side: THREE.DoubleSide}));
        screen.position.set(0, 1.3, 1.7); screen.rotation.y = Math.PI; screen.userData.isMasterMonitor = true; this.group.add(screen);

        scene.add(this.group); setInterval(() => this.drawMonitor(), 1000); this.bindUI();
    }
    
    drawMonitor() {
        const grad = this.ctx.createLinearGradient(0, 0, 800, 600); grad.addColorStop(0, '#020617'); grad.addColorStop(1, '#0f172a');
        this.ctx.fillStyle = grad; this.ctx.fillRect(0,0,800,600);
        this.ctx.strokeStyle = 'rgba(255,255,255,0.05)'; this.ctx.lineWidth = 1;
        for(let i=0; i<800; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(i,0); this.ctx.lineTo(i,600); this.ctx.stroke(); }
        for(let i=0; i<600; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(0,i); this.ctx.lineTo(800,i); this.ctx.stroke(); }

        this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(0,0,800,50);
        this.ctx.fillStyle = '#38bdf8'; this.ctx.font = 'bold 24px Arial'; this.ctx.textAlign = 'left'; this.ctx.fillText('DirectorOS // Global Access Terminal', 20, 35);
        this.ctx.fillStyle = '#4ade80'; this.ctx.font = '16px monospace'; this.ctx.textAlign = 'right'; this.ctx.fillText(`Active Mixes: ${window.LabState.inventory.length}`, 780, 32);

        const drawApp = (x, y, color, title, icon) => {
            this.ctx.fillStyle = 'rgba(30,41,59,0.8)'; this.ctx.fillRect(x, y, 120, 120);
            this.ctx.strokeStyle = color; this.ctx.lineWidth = 2; this.ctx.strokeRect(x, y, 120, 120);
            this.ctx.fillStyle = color; this.ctx.font = '40px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText(icon, x+60, y+65);
            this.ctx.fillStyle = '#fff'; this.ctx.font = '14px Arial'; this.ctx.fillText(title, x+60, y+100);
        };
        
        drawApp(150, 100, '#3b82f6', 'ACI Prep OS', '🧪'); drawApp(340, 100, '#eab308', 'Slump OS', '📐'); drawApp(530, 100, '#ef4444', 'UTM Server', '🏗️');
        drawApp(150, 260, '#8b5cf6', 'Sieve Plotter', '📊'); drawApp(340, 260, '#10b981', 'LA Abrasion', '⚙️'); drawApp(530, 260, '#f97316', 'Oven Data', '🔥');
        drawApp(340, 420, '#8b5a2b', 'CBR Analysis', '🌍'); drawApp(530, 420, '#a855f7', 'NDT Suite', '📡');

        this.screenTex.needsUpdate = true;
    }

    bindUI() {
        const canvas = document.getElementById('masterMonitorCanvas');
        canvas.addEventListener('click', (e) => {
            if(canvas.style.display !== 'block') return;
            const rect = canvas.getBoundingClientRect(); const x = (e.clientX - rect.left) * (canvas.width / rect.width); const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            if(x > 750 && x < 790 && y > 10 && y < 50) { document.getElementById('osContainer').classList.remove('active'); if(!window.isMobileTouch) window.controls.lock(); return; }
            const switchApp = (id) => { canvas.style.display = 'none'; document.getElementById(id).style.display = 'block'; };
            if(x>150&&x<270 && y>100&&y<220) switchApp('prepMonitorCanvas');
            if(x>340&&x<460 && y>100&&y<220) switchApp('slumpMonitorCanvas');
            if(x>530&&x<650 && y>100&&y<220) switchApp('utmMonitorCanvas');
            if(x>150&&x<270 && y>260&&y<380) switchApp('sieveMonitorCanvas');
            if(x>340&&x<460 && y>260&&y<380) switchApp('laMonitorCanvas');
            if(x>530&&x<650 && y>260&&y<380) switchApp('ovenMonitorCanvas');
            if(x>340&&x<460 && y>420&&y<540) switchApp('cbrMonitorCanvas');
            if(x>530&&x<650 && y>420&&y<540) switchApp('ndtMonitorCanvas');
        });
    }
    update(delta) {}
}

class CuringTank {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); this.group.position.set(x, 0, z);
        this.uiID = 'curingUI'; this.uiVisible = false; this.name = "Accelerated Weathering Chamber";
        this.state = { env: 'standard' }; 

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

        this.cylindersInTank = []; scene.add(this.group); 
        this.injectWeatheringUI();
        this.bindUI();
    }

    injectWeatheringUI() {
        const curingUI = document.getElementById('curingUI');
        if(curingUI && !document.getElementById('envSelect')) {
            const grp = document.createElement('div');
            grp.className = 'control-group'; grp.style.width = '100%';
            grp.innerHTML = `<label class="label">Exposure Environment</label><select id="envSelect" style="margin-bottom: 10px;"><option value="standard">Standard Moist Curing (100% RH)</option><option value="nacl">Harsh Marine Exposure (5% NaCl)</option></select>`;
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

    bindUI() {
        const cure = (days) => {
            window.LabState.timeDays += days;
            
            window.LabState.inventory.forEach(item => {
                if(item.age === undefined) item.age = 0; item.age += days;
                const maturity = Math.min(1.0, Math.log10(item.age + 1) / Math.log10(29));
                item.currentFc = (item.targetFc || 30) * maturity; 
                
                if (this.state.env === 'nacl') { item.corrosionLevel = (item.corrosionLevel || 0) + (days * 0.015); }
            });

            this.cylindersInTank.forEach(mesh => {
                let mix = mesh.userData.mixData;
                if (mix.corrosionLevel > 0.2) {
                    mesh.material = new THREE.MeshStandardMaterial({ map: this.generateRustTexture(mix.corrosionLevel), roughness: 1.0 });
                }
            });

            alert(`Advanced time by ${days} days.\nEnvironment: ${this.state.env === 'nacl' ? '5% NaCl Solution' : 'Moist Room'}\nTotal Lab Age: Day ${window.LabState.timeDays}`);
            window.dispatchEvent(new Event('inventoryUpdate')); document.getElementById('closeTabletBtn').click();
        };
        
        document.getElementById('cure3Btn').onclick = () => cure(3);
        document.getElementById('cure7Btn').onclick = () => cure(7);
        document.getElementById('cure28Btn').onclick = () => cure(28);
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
    { id: 'oven', name: 'Oven & Absorption', obj: ovenObj },
    { id: 'sieve', name: 'Sieve Analysis', obj: sieveObj },
    { id: 'la', name: 'Los Angeles Abrasion', obj: laObj },
    { id: 'cbr', name: 'CBR Soil Test', obj: cbrObj },
    { id: 'utm', name: 'Mechanical Testing', obj: utmObj },
    { id: 'slump', name: 'Slump Test', obj: slumpObj },
    { id: 'ndt', name: 'NDT Station', obj: ndtObj }
];

stations.forEach(data => {
    const light = new THREE.SpotLight(0xffffff, 0.6);
    light.position.set(data.obj.group.position.x, 5.5, data.obj.group.position.z);
    light.target.position.set(data.obj.group.position.x, 0, data.obj.group.position.z);
    light.angle = Math.PI / 3; light.penumbra = 0.5; light.castShadow = false; 
    scene.add(light); scene.add(light.target);
});

scene.traverse((obj) => {
    if (obj.isMesh && obj.userData) {
        const isMonitorScreen = Object.keys(obj.userData).some(k => k.endsWith('Monitor'));
        if (isMonitorScreen && obj.geometry.type === 'PlaneGeometry' && !obj.userData.isNDTMonitor && !obj.userData.isMasterMonitor) {
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
        document.getElementById('crosshair').style.display = 'block'; // Keep crosshair active for targeting
    } else {
        window.controls.lock();
    }
});

document.getElementById('canvasContainer').addEventListener('click', () => {
    if (!window.isMobileTouch && !window.controls.isLocked && window.gameActive && !document.getElementById('osContainer').classList.contains('active') && document.getElementById('labTablet').style.display !== 'flex') {
        window.controls.lock();
    }
});

window.controls.addEventListener('lock', () => { document.getElementById('uiInstruction').style.display = 'block'; document.getElementById('labTablet').style.display = 'none'; });
window.controls.addEventListener('unlock', () => { document.getElementById('crosshair').className = ''; document.getElementById('uiInstruction').style.display = 'none'; });

let isSprinting = false; let isCrouching = false; let isInspecting = false;
let moveF = false, moveB = false, moveL = false, moveR = false;
const raycaster = new THREE.Raycaster();
let lastTabPress = 0; 

// --- UNIFIED ACTION FUNCTIONS ---
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
        }
        else if(hit.userData.isUTMLoader && window.LabState.handItem && window.LabState.handItem.userData.isGrabbableCylinder) {
            const item = window.LabState.handItem; const utm = stations.find(s => s.id === 'utm').obj; utm.loadSpecimenFromHand(item.userData.mixData);
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
        const allMonitors = ['masterMonitorCanvas', 'sieveMonitorCanvas', 'utmMonitorCanvas', 'slumpMonitorCanvas', 'prepMonitorCanvas', 'laMonitorCanvas', 'ovenMonitorCanvas', 'cbrMonitorCanvas', 'ndtMonitorCanvas'];
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
        
        if (matched) { 
            document.getElementById('osContainer').classList.add('active'); 
            allMonitors.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = (id === matched) ? 'block' : 'none'; }); 
            if(!window.isMobileTouch) window.controls.unlock(); 
        }
    }
}

// --- PC EVENT LISTENERS ---
document.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if(e.code === 'KeyW') moveF = true; if(e.code === 'KeyS') moveB = true;
    if(e.code === 'KeyA') moveL = true; if(e.code === 'KeyD') moveR = true;
    if(e.code === 'ShiftLeft') isSprinting = true;
    if(e.code === 'KeyC') isCrouching = !isCrouching; 
    if(e.code === 'KeyE') handleInteract();
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

// --- MOBILE TOUCH LISTENERS ---
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
                // Manually manipulate camera for mobile look
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
            if(now - lastLookTap < 300) { handleMonitorClick(); } // Simulate double click for monitors
            lastLookTap = now;
        }
    }
});

// Mobile Action Buttons
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


// --- GENERAL UI ---
document.getElementById('closeTabletBtn').addEventListener('click', () => { 
    const tablet = document.getElementById('labTablet'); tablet.style.display = 'none'; tablet.classList.remove('full-screen');
    if(!document.getElementById('osContainer').classList.contains('active')) { if(!window.isMobileTouch) window.controls.lock(); }
});
document.getElementById('closeOSBtn').addEventListener('click', () => { 
    const masterCanvas = document.getElementById('masterMonitorCanvas');
    if (masterCanvas.style.display === 'none' && window.currentStation && window.currentStation.id === 'master') {
        const allMonitors = ['sieveMonitorCanvas', 'utmMonitorCanvas', 'slumpMonitorCanvas', 'prepMonitorCanvas', 'laMonitorCanvas', 'ovenMonitorCanvas', 'cbrMonitorCanvas', 'ndtMonitorCanvas'];
        allMonitors.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
        masterCanvas.style.display = 'block';
    } else {
        document.getElementById('osContainer').classList.remove('active'); if(!window.isMobileTouch) window.controls.lock(); 
    }
});
window.addEventListener('inventoryUpdate', () => {
    const invDisplay = document.getElementById('invDisplay');
    if(invDisplay) {
        invDisplay.textContent = `${window.LabState.inventory.length} Mixes (Day ${window.LabState.timeDays})`;
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

    const tabletOpen = document.getElementById('labTablet').style.display === 'flex';
    const osOpen = document.getElementById('osContainer').classList.contains('active');
    const canMove = window.gameActive && !isInspecting && !tabletOpen && !osOpen && (window.controls.isLocked || window.isMobileTouch);

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

        // Apply movement natively based on camera direction
        if(window.isMobileTouch) {
            camera.translateX(-velocity.x * delta);
            camera.translateZ(-velocity.z * delta);
        } else {
            window.controls.moveRight(-velocity.x * delta); 
            window.controls.moveForward(-velocity.z * delta);
        }
        
        const targetY = isCrouching ? 0.8 : 1.6;
        camera.position.y += (targetY - camera.position.y) * 0.1;
    }

    if (canMove) {
        raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        const ch = document.getElementById('crosshair');
        if(window.isMobileTouch) ch.style.display = 'block'; // Always show crosshair on mobile
        
        if (intersects.length > 0 && intersects[0].distance < 3) {
            const obj = intersects[0].object;
            if(obj.userData.isGrabbableCylinder) {
                ch.className = 'grab'; document.getElementById('uiInstruction').textContent = "Press [E] or 🖐️ to Pick Up"; document.getElementById('uiInstruction').style.display = 'block';
            } else if(obj.userData.isCuringTank && window.LabState.handItem) {
                ch.className = 'interact'; document.getElementById('uiInstruction').textContent = "Press [E] or 🖐️ to Place in Tank"; document.getElementById('uiInstruction').style.display = 'block';
            } else if(obj.userData.isUTMLoader && window.LabState.handItem) {
                ch.className = 'interact'; document.getElementById('uiInstruction').textContent = "Press [E] or 🖐️ to Load UTM"; document.getElementById('uiInstruction').style.display = 'block';
            } else if(obj.userData.isOvenLoader && window.LabState.handItem) {
                ch.className = 'interact'; document.getElementById('uiInstruction').textContent = "Press [E] or 🖐️ to Load Oven"; document.getElementById('uiInstruction').style.display = 'block';
            } else if (obj.userData.isPrepBowl) {
                ch.className = 'interact'; document.getElementById('uiInstruction').textContent = "Hold Click & Drag to Hand Mix"; document.getElementById('uiInstruction').style.display = 'block';
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
        document.getElementById('uiInstruction').textContent = window.isMobileTouch ? "Tap 📱 to open Tablet" : "Press TAB for Tablet";
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