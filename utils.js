function createConcreteTex(baseColor) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = baseColor; ctx.fillRect(0, 0, 256, 256);
    for(let i=0; i<15000; i++) { ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'; ctx.fillRect(Math.random()*256, Math.random()*256, 2, 2); }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; return tex;
}

function createNoiseTexture(baseColor, drawCrack = false, isCube = false) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = baseColor; ctx.fillRect(0, 0, 512, 512);
    for(let i=0; i<30000; i++) { ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'; ctx.fillRect(Math.random()*512, Math.random()*512, 2, 2); }
    if (drawCrack) {
        ctx.strokeStyle = 'rgba(20,20,20,0.9)'; ctx.lineWidth = 6;
        if (isCube) { ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(512,512); ctx.stroke(); ctx.beginPath(); ctx.moveTo(512,0); ctx.lineTo(0,512); ctx.stroke(); } 
        else { ctx.beginPath(); ctx.moveTo(100,0); ctx.lineTo(150,512); ctx.stroke(); ctx.beginPath(); ctx.moveTo(400,0); ctx.lineTo(350,512); ctx.stroke(); ctx.beginPath(); ctx.moveTo(250,0); ctx.lineTo(250,512); ctx.stroke(); }
    }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; return tex;
}

function createMeshTexture(density) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0,0,256,256);
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3; const step = 256 / density;
    for(let i=0; i<256; i+=step) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke(); }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; return tex;
}

function createSieveLabel(text) {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#111'; ctx.fillRect(0,0,128,64);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'; ctx.fillText(text, 64, 40);
    return new THREE.CanvasTexture(canvas);
}

function createEpoxyFloor() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0,0,512,512);
    for(let i=0; i<40000; i++) { ctx.fillStyle = Math.random() > 0.8 ? '#94a3b8' : (Math.random() > 0.5 ? '#f8fafc' : '#cbd5e1'); ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*512, Math.random()*1.5, 0, Math.PI*2); ctx.fill(); }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10, 10); return tex;
}

function createCinderblockWall() {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0,0,256,256); ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 4;
    for(let y=0; y<256; y+=32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(256,y); ctx.stroke(); let offset = (y/32)%2 === 0 ? 0 : 32; for(let x=offset; x<=256; x+=64) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+32); ctx.stroke(); } }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(20, 4); return tex;
}

function createCeiling() {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,256,256); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.strokeRect(0,0,256,256);
    for(let i=0; i<5000; i++) { ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(Math.random()*256, Math.random()*256, 2, 2); }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(20, 15); return tex;
}

function createWhiteboard(title, bodyText) {
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,800,600);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 30; ctx.strokeRect(0,0,800,600);
    
    ctx.fillStyle = '#1e3a8a'; ctx.font = 'bold 44px Arial'; ctx.textAlign = 'center'; ctx.fillText(title, 400, 80);
    ctx.beginPath(); ctx.moveTo(50, 110); ctx.lineTo(750, 110); ctx.lineWidth = 4; ctx.strokeStyle = '#cbd5e1'; ctx.stroke();

    ctx.fillStyle = '#0f172a'; ctx.font = '28px monospace'; ctx.textAlign = 'left';
    const lines = bodyText.split('\n');
    lines.forEach((line, i) => { ctx.fillText(line.trim(), 60, 170 + (i * 45)); });

    const tex = new THREE.CanvasTexture(canvas);
    return new THREE.Mesh(new THREE.PlaneGeometry(3, 2.25), new THREE.MeshBasicMaterial({map: tex}));
}

function createAntiVibrationMat(w, d) {
    const mat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.9}));
    mat.position.y = 0.01; mat.receiveShadow = true;
    return mat;
}

const freshConcreteMat = new THREE.MeshStandardMaterial({ map: createConcreteTex('#64748b'), bumpMap: createConcreteTex('#64748b'), bumpScale: 0.005, roughness: 0.4 });
const compactedConcreteMat = new THREE.MeshStandardMaterial({ map: createConcreteTex('#475569'), bumpMap: createConcreteTex('#475569'), bumpScale: 0.01, roughness: 0.7 });
const curedConcreteMat = new THREE.MeshStandardMaterial({ map: createConcreteTex('#cbd5e1'), bumpMap: createConcreteTex('#cbd5e1'), bumpScale: 0.02, roughness: 0.9 }); 
const steelMatGeneral = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.1 });