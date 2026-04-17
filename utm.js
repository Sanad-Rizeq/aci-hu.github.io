class UTMStation {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); this.group.position.set(x, 0, z);
        this.uiID = 'utmUI'; this.uiVisible = false; this.name = 'Mechanical Testing';
        
        this.testState = { activeMix: null, status: 'IDLE', strain: 0, stress: 0, load: 0, speed: 0.0001, dataPoints: [] };
        this.osState = 'desktop';
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.motorOsc = null;
        this.debrisParticles = []; this.debrisMesh = null; this.dummy = new THREE.Object3D();

        this.buildMachine(); scene.add(this.group); this.injectFlexuralUI(); this.bindUI(); this.resetMachine();
        
        setInterval(() => { if(this.osState === 'desktop') this.drawMonitor(false); }, 1000);
    }

    injectFlexuralUI() {
        const utmType = document.getElementById('utmType');
        if (utmType && !document.querySelector('#utmType option[value="beam_rebar"]')) {
            const opt = document.createElement('option');
            opt.value = 'beam_rebar';
            opt.text = 'Reinforced Beam (Flexural)';
            utmType.add(opt);
        }
    }

    buildMachine() {
        this.group.add(createAntiVibrationMat(2.0, 2.0));
        const frameMat = new THREE.MeshStandardMaterial({color: 0xeab308, roughness: 0.6, metalness: 0.8});
        this.matSteel = new THREE.MeshStandardMaterial({color: 0x94a3b8, metalness: 0.9, roughness: 0.2});

        const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.8), frameMat); base.position.y = 0.2; this.group.add(base);
        const col1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.0), this.matSteel); col1.position.set(-0.6, 1.4, 0); this.group.add(col1);
        const col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.0), this.matSteel); col2.position.set(0.6, 1.4, 0); this.group.add(col2);
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.6), frameMat); top.position.y = 2.4; this.group.add(top);

        this.crosshead = new THREE.Group(); this.crosshead.position.y = 1.6; this.group.add(this.crosshead);
        const crossBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.5), frameMat); this.crosshead.add(crossBody);
        
        // Compression Platens
        this.upperPlaten = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05), this.matSteel); this.upperPlaten.position.y = -0.125; this.crosshead.add(this.upperPlaten);
        this.lowerPlaten = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05), this.matSteel); this.lowerPlaten.position.y = 0.425; this.group.add(this.lowerPlaten);
        
        // MISSING LINK FIXED: Tensile Grips for Steel
        this.tensGripBottom = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), new THREE.MeshStandardMaterial({color: 0x111111}));
        this.tensGripBottom.position.y = 0.5; this.group.add(this.tensGripBottom);
        this.tensGripTop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), new THREE.MeshStandardMaterial({color: 0x111111}));
        this.tensGripTop.position.y = -0.25; this.crosshead.add(this.tensGripTop);
        this.tensGripTop.visible = false; this.tensGripBottom.visible = false;

        // Flexural Mounts
        this.flexuralNose = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), this.matSteel); 
        this.flexuralNose.rotation.x = Math.PI/2; this.flexuralNose.position.y = -0.15; this.flexuralNose.visible = false; this.crosshead.add(this.flexuralNose);
        this.flexuralSupports = new THREE.Group(); this.flexuralSupports.position.y = 0.425; this.flexuralSupports.visible = false; this.group.add(this.flexuralSupports);
        const sup1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), this.matSteel); sup1.rotation.x = Math.PI/2; sup1.position.set(-0.3, 0.02, 0); this.flexuralSupports.add(sup1);
        const sup2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), this.matSteel); sup2.rotation.x = Math.PI/2; sup2.position.set(0.3, 0.02, 0); this.flexuralSupports.add(sup2);

        this.specimenGroup = new THREE.Group(); this.group.add(this.specimenGroup);

        const canvas = document.getElementById('utmMonitorCanvas'); this.ctx = canvas.getContext('2d'); this.screenTex = new THREE.CanvasTexture(canvas);
        const monitorGroup = new THREE.Group(); monitorGroup.position.set(1.1, 1.4, 0); monitorGroup.rotation.y = -Math.PI / 4; this.group.add(monitorGroup);
        const screenBox = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.05), new THREE.MeshStandardMaterial({color: 0x111111})); monitorGroup.add(screenBox);
        const display = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({map: this.screenTex})); display.position.z = 0.026; display.userData.isUTMMonitor = true; monitorGroup.add(display);

        this.particleMat = new THREE.MeshStandardMaterial({color: 0x64748b, roughness: 0.9});
        this.debrisMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), this.particleMat, 50);
        this.group.add(this.debrisMesh);
        for(let i=0; i<50; i++) this.debrisParticles.push({ active: false, x:0, y:0, z:0, vx:0, vy:0, vz:0, rotX:0, rotY:0, rotZ:0 });
    }

    startMotorSound() {
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        if(this.motorOsc) return;
        this.motorOsc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
        this.motorOsc.type = 'square'; this.motorOsc.frequency.setValueAtTime(40, this.audioCtx.currentTime); 
        const filter = this.audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 300;
        gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        this.motorOsc.connect(filter); filter.connect(gain); gain.connect(this.audioCtx.destination); this.motorOsc.start();
    }

    stopMotorSound() { if(this.motorOsc) { this.motorOsc.stop(); this.motorOsc = null; } }

    playCrackSound(isSteel) {
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
        if(isSteel) { osc.type = 'square'; osc.frequency.setValueAtTime(1200, this.audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.1); gain.gain.setValueAtTime(1, this.audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15); } 
        else { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(80, this.audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(10, this.audioCtx.currentTime + 0.5); gain.gain.setValueAtTime(2.0, this.audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5); }
        osc.connect(gain); gain.connect(this.audioCtx.destination); osc.start(); osc.stop(this.audioCtx.currentTime + 0.6);
    }

    resetMachine() {
        this.testState.status = 'IDLE'; this.testState.strain = 0; this.testState.stress = 0; this.testState.load = 0; this.testState.dataPoints = []; this.stopMotorSound(); 
        this.debrisParticles.forEach(p => p.active = false);
        for(let i=0; i<50; i++) { this.dummy.position.set(0,-100,0); this.dummy.updateMatrix(); this.debrisMesh.setMatrixAt(i, this.dummy.matrix); }
        this.debrisMesh.instanceMatrix.needsUpdate = true;
        
        while(this.specimenGroup.children.length > 0) this.specimenGroup.remove(this.specimenGroup.children[0]);
        this.testMesh = null;
        document.getElementById('utmStartBtn').disabled = false;
        
        this.upperPlaten.visible = true; this.lowerPlaten.visible = true;
        this.tensGripTop.visible = false; this.tensGripBottom.visible = false;
        this.flexuralNose.visible = false; this.flexuralSupports.visible = false;
        
        this.drawMonitor();
    }

    loadSpecimenFromHand(mixData) {
        this.resetMachine();
        this.testState.activeMix = mixData;
        const isCyl = mixData.type === 'cylinder';
        this.testMesh = new THREE.Mesh(
            isCyl ? new THREE.CylinderGeometry(0.075, 0.075, 0.3, 32) : new THREE.BoxGeometry(0.15, 0.15, 0.15),
            new THREE.MeshStandardMaterial({color: 0x64748b, roughness: 0.9})
        );
        const hOrig = isCyl ? 0.3 : 0.15;
        this.testMesh.position.set(0, 0.45 + (hOrig/2), 0);
        this.specimenGroup.add(this.testMesh);
        this.crosshead.position.y = 0.45 + hOrig + 0.125;
        return true;
    }

    loadDefaultSpecimen() {
        this.resetMachine();
        const type = document.getElementById('utmType').value;
        this.testState.activeMix = { name: type.toUpperCase(), type: type, currentFc: 30, corrosionLevel: 0 };
        
        if (type === 'steel') {
            this.testState.activeMix.currentFc = 400; 
            
            // Rebar mapped correctly
            this.testMesh = new THREE.Group();
            this.steelTop = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.25, 16, 16), this.matSteel); 
            this.steelBot = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.25, 16, 16), this.matSteel);
            this.steelTop.position.y = 0.725; this.steelBot.position.y = 0.475; 
            this.steelTop.castShadow = true; this.steelBot.castShadow = true;
            this.testMesh.add(this.steelTop); this.testMesh.add(this.steelBot);
            this.specimenGroup.add(this.testMesh);
            
            this.upperPlaten.visible = false; this.lowerPlaten.visible = false;
            this.tensGripTop.visible = true; this.tensGripBottom.visible = true;
            this.crosshead.position.y = 1.15;
            
        } else if (type === 'beam_rebar') {
            this.testMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.2), new THREE.MeshStandardMaterial({color: 0x64748b, roughness: 0.9}));
            this.testMesh.position.set(0, 0.54, 0); this.specimenGroup.add(this.testMesh);
            
            this.upperPlaten.visible = false; this.lowerPlaten.visible = false;
            this.flexuralNose.visible = true; this.flexuralSupports.visible = true;
            this.crosshead.position.y = 0.79;
        } else {
            const isCyl = type === 'cylinder';
            this.testMesh = new THREE.Mesh(
                isCyl ? new THREE.CylinderGeometry(0.075, 0.075, 0.3, 32) : new THREE.BoxGeometry(0.15, 0.15, 0.15),
                new THREE.MeshStandardMaterial({color: 0x64748b, roughness: 0.9})
            );
            const hOrig = isCyl ? 0.3 : 0.15;
            this.testMesh.position.set(0, 0.45 + (hOrig/2), 0);
            this.specimenGroup.add(this.testMesh);
            this.crosshead.position.y = 0.45 + hOrig + 0.125;
        }
        this.drawMonitor();
    }

    drawMonitor() {
        this.ctx.fillStyle = '#d4d0c8'; this.ctx.fillRect(0,0,800,600);
        this.ctx.fillStyle = '#808080'; this.ctx.fillRect(0,0,800,40);
        this.ctx.fillStyle = '#ffffff'; this.ctx.font = 'bold 20px Arial'; this.ctx.textAlign='left';
        this.ctx.fillText('INSTRON / ACI MECHANICAL TEST SUITE', 20, 28);

        const mix = this.testState.activeMix;
        
        this.ctx.fillStyle = '#ffffff'; this.ctx.fillRect(20, 60, 760, 80);
        this.ctx.strokeStyle = '#808080'; this.ctx.lineWidth = 2; this.ctx.strokeRect(20, 60, 760, 80);
        
        this.ctx.fillStyle = '#000000'; this.ctx.font = '16px monospace';
        this.ctx.fillText(`SPECIMEN: ${mix ? mix.name : 'NONE'}`, 40, 90);
        this.ctx.fillText(`STATUS:   ${this.testState.status}`, 40, 120);

        if (mix && mix.corrosionLevel > 0.1) {
            this.ctx.fillStyle = '#b91c1c'; this.ctx.font = 'bold 18px monospace';
            this.ctx.fillText(`! PATHOLOGY: CHLORIDE CORROSION DETECTED (${Math.round(mix.corrosionLevel*100)}%) !`, 300, 90);
        }

        this.ctx.fillStyle = '#000000'; this.ctx.fillRect(20, 160, 200, 400);
        this.ctx.fillStyle = '#00ff00'; this.ctx.font = '24px monospace';
        this.ctx.fillText('LOAD (kN)', 30, 200);
        this.ctx.fillText(this.testState.load.toFixed(2), 30, 230);
        this.ctx.fillText('STRESS (MPa)', 30, 280);
        this.ctx.fillText(this.testState.stress.toFixed(2), 30, 310);
        this.ctx.fillText('STRAIN (%)', 30, 360);
        this.ctx.fillText((this.testState.strain * 100).toFixed(3), 30, 390);

        // CLIPPED GRAPH RENDERER
        this.ctx.fillStyle = '#ffffff'; this.ctx.fillRect(240, 160, 540, 400);
        
        const gX = 240, gY = 560, gW = 540, gH = 400;
        const isSteel = mix && mix.type === 'steel';
        const isBeam = mix && mix.type === 'beam_rebar';
        const peakStress = mix ? (mix.currentFc || 30) : 30;

        let maxE = 0.004; let maxS = peakStress * 1.5;
        if (isSteel) { maxE = 0.18; maxS = 650; }
        else if (isBeam) { maxE = 0.03; maxS = peakStress * 0.3; } 
        else if (mix && mix.type === 'cube') { maxE = 0.005; maxS = peakStress * 1.8; }

        this.ctx.strokeStyle = '#808080'; this.ctx.lineWidth = 1;
        this.ctx.fillStyle = '#000'; this.ctx.font = '10px Arial'; this.ctx.textAlign = 'right';
        for(let i=0; i<=5; i++) { 
            const y = gY - (i/5)*gH; 
            this.ctx.fillText(((i/5)*maxS).toFixed(0), gX - 8, y + 4);
            this.ctx.beginPath(); this.ctx.moveTo(gX, y); this.ctx.lineTo(gX+gW, y); this.ctx.stroke(); 
        }
        this.ctx.textAlign = 'center';
        for(let i=0; i<=5; i++) { 
            const x = gX + (i/5)*gW; 
            this.ctx.fillText(((i/5)*maxE * 100).toFixed(1) + '%', x, gY + 15);
            this.ctx.beginPath(); this.ctx.moveTo(x, gY); this.ctx.lineTo(x, gY-gH); this.ctx.stroke(); 
        }

        // Draw Mathematically Accurate Curve
        this.ctx.save();
        this.ctx.beginPath(); this.ctx.rect(gX, gY - gH, gW, gH); this.ctx.clip(); 
        
        this.ctx.beginPath(); 
        this.ctx.strokeStyle = this.testState.status === 'FAILED' || this.testState.status === 'FRACTURED' ? '#ff0000' : '#0000ff'; 
        this.ctx.lineWidth = 3;
        
        for (let i = 0; i < this.testState.dataPoints.length; i++) {
            let pt = this.testState.dataPoints[i];
            let x = gX + (pt.strain / maxE) * gW; 
            let y = gY - (pt.stress / maxS) * gH; 
            if (i === 0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
        this.ctx.restore();

        this.screenTex.needsUpdate = true;
    }

    bindUI() {
        document.getElementById('utmType').onchange = () => this.loadDefaultSpecimen();
        document.getElementById('resetUTM').onclick = () => this.resetMachine();
        document.getElementById('utmStartBtn').onclick = () => {
            if(!this.testState.activeMix) this.loadDefaultSpecimen();
            this.testState.status = 'RUNNING';
            document.getElementById('utmStartBtn').disabled = true;
            this.startMotorSound();
        };
    }

    addCracksToMesh(type, w, h, d) {
        if(!this.testMesh) return;
        const crackMat = new THREE.MeshBasicMaterial({color: 0x111111}); 
        
        const drawCrack = (start, end, segments, jitter, thickness) => {
            const points = [];
            for(let i=0; i<=segments; i++) {
                const t = i/segments;
                const jx = (i===0 || i===segments) ? 0 : (Math.random()-0.5)*jitter;
                const jy = (i===0 || i===segments) ? 0 : (Math.random()-0.5)*jitter;
                const jz = (i===0 || i===segments) ? 0 : (Math.random()-0.5)*jitter;
                points.push(new THREE.Vector3(
                    start.x + (end.x - start.x)*t + jx,
                    start.y + (end.y - start.y)*t + jy,
                    start.z + (end.z - start.z)*t + jz
                ));
            }
            const curve = new THREE.CatmullRomCurve3(points);
            const geo = new THREE.TubeGeometry(curve, segments*2, thickness, 4, false);
            const mesh = new THREE.Mesh(geo, crackMat);
            this.testMesh.add(mesh); 
        };

        if (type === 'cylinder') {
            for(let i=0; i<4; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = w; 
                const start = new THREE.Vector3(Math.cos(angle)*r*1.02, h/2, Math.sin(angle)*r*1.02);
                const end = new THREE.Vector3(Math.cos(angle+1.5)*r*1.02, -h/2, Math.sin(angle+1.5)*r*1.02);
                drawCrack(start, end, 6, 0.02, 0.003);
            }
            for(let i=0; i<3; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = w;
                const start = new THREE.Vector3(Math.cos(angle)*r*1.02, h/2, Math.sin(angle)*r*1.02);
                const end = new THREE.Vector3(Math.cos(angle)*r*1.02, -h/2, Math.sin(angle)*r*1.02);
                drawCrack(start, end, 6, 0.02, 0.002);
            }
        } 
        else if (type === 'cube') {
            const hd = d/2 + 0.001; const hw = w/2 + 0.001; const hh = h/2;
            drawCrack(new THREE.Vector3(-hw, hh, hd), new THREE.Vector3(hw, -hh, hd), 6, 0.015, 0.003);
            drawCrack(new THREE.Vector3(hw, hh, hd), new THREE.Vector3(-hw, -hh, hd), 6, 0.015, 0.003);
            drawCrack(new THREE.Vector3(hw, hh, hd), new THREE.Vector3(hw, -hh, -hd), 6, 0.015, 0.003);
            drawCrack(new THREE.Vector3(hw, hh, -hd), new THREE.Vector3(hw, -hh, hd), 6, 0.015, 0.003);
            drawCrack(new THREE.Vector3(-hw, hh, hd), new THREE.Vector3(-hw, -hh, -hd), 6, 0.015, 0.003);
            drawCrack(new THREE.Vector3(-hw, hh, -hd), new THREE.Vector3(-hw, -hh, hd), 6, 0.015, 0.003);
        }
        else if (type === 'beam_rebar') {
            for(let i=0; i<8; i++) {
                const startX = (Math.random() - 0.5) * 0.4; 
                const faceZ = d/2 + 0.002;
                const startF = new THREE.Vector3(startX, -h/2, faceZ);
                const endF = new THREE.Vector3(startX + (Math.random()-0.5)*0.05, (Math.random()*0.8)*h/2, faceZ);
                drawCrack(startF, endF, 6, 0.01, 0.002);
                const startB = new THREE.Vector3(startX, -h/2, -faceZ);
                const endB = new THREE.Vector3(startX + (Math.random()-0.5)*0.05, (Math.random()*0.8)*h/2, -faceZ);
                drawCrack(startB, endB, 6, 0.01, 0.002);
            }
        }
    }

    failSpecimen(type) {
        if(this.testState.status === 'FAILED' || this.testState.status === 'FRACTURED') return; 
        this.testState.status = 'FRACTURED';
        this.stopMotorSound();
        
        for(let i=0; i<50; i++) {
            let p = this.debrisParticles[i]; p.active = true;
            p.x = (Math.random()-0.5)*0.2; p.y = 0.6 + Math.random()*0.2; p.z = (Math.random()-0.5)*0.2;
            p.vx = (Math.random()-0.5)*2; p.vy = Math.random()*2; p.vz = (Math.random()-0.5)*2;
        }

        if (type === 'steel') {
            this.playCrackSound(true);
            
            // CUP AND CONE RUPTURE FIX
            const geoTop = new THREE.CylinderGeometry(0.016, 0.006, 0.25, 16, 16);
            const posT = geoTop.attributes.position;
            for(let i=0; i<posT.count; i++) {
                if (posT.getY(i) > -0.1) { 
                    let x = posT.getX(i); let z = posT.getZ(i); let r = Math.sqrt(x*x + z*z);
                    if(r > 0) { posT.setX(i, (x/r)*0.016); posT.setZ(i, (z/r)*0.016); }
                }
            }
            geoTop.computeVertexNormals();

            const geoBot = new THREE.CylinderGeometry(0.006, 0.016, 0.25, 16, 16);
            const posB = geoBot.attributes.position;
            for(let i=0; i<posB.count; i++) {
                if (posB.getY(i) < 0.1) { 
                    let x = posB.getX(i); let z = posB.getZ(i); let r = Math.sqrt(x*x + z*z);
                    if(r > 0) { posB.setX(i, (x/r)*0.016); posB.setZ(i, (z/r)*0.016); }
                }
            }
            geoBot.computeVertexNormals();

            this.steelTop.geometry.dispose(); this.steelBot.geometry.dispose();
            this.steelTop.geometry = geoTop; this.steelBot.geometry = geoBot;

            gsap.to(this.steelTop.position, {y: "+=0.04", duration: 0.1, ease: "power1.out"});
            gsap.to(this.steelBot.position, {y: "-=0.04", duration: 0.1, ease: "power1.out"});
            
        } else {
            this.playCrackSound(false);
            
            if (type === 'cylinder') {
                this.addCracksToMesh('cylinder', 0.075, 0.3, 0.075);
                gsap.to(this.testMesh.scale, {x: 1.05, z: 1.05, y: 0.95, duration: 0.1}); 
            } else if (type === 'cube') {
                this.addCracksToMesh('cube', 0.15, 0.15, 0.15);
                gsap.to(this.testMesh.scale, {x: 1.05, z: 1.05, y: 0.95, duration: 0.1}); 
            } else if (type === 'beam_rebar') {
                this.addCracksToMesh('beam_rebar', 0.8, 0.2, 0.2);
                gsap.to(this.testMesh.position, {y: this.testMesh.position.y - 0.02, duration: 0.1}); 
            }
        }
        
        if(this.osState === 'software') this.drawMonitor(true);
    }

    update(delta) {
        if(this.testState.status === 'RUNNING') {
            const mix = this.testState.activeMix;
            const isSteel = mix.type === 'steel';
            const isBeam = mix.type === 'beam_rebar';
            
            let peakStress = mix.currentFc || 30;
            let corrosion = mix.corrosionLevel || 0;
            let curStress = 0;
            
            if (isBeam && corrosion > 0) {
                peakStress = peakStress * Math.max(0.2, (1 - corrosion*1.5)); 
            }

            if (isSteel) {
                this.testState.speed = 0.02; 
                this.testState.strain += delta * this.testState.speed;
                let e = this.testState.strain;
                
                const E = 200000; const Fy = peakStress; const Fu = 550; 
                const ey = Fy / E; const esh = 0.02; const eu = 0.12; const ef = 0.16;

                if (e <= ey) { curStress = e * E; } 
                else if (e <= esh) { curStress = Fy; } 
                else if (e <= eu) { 
                    const p = (e - esh) / (eu - esh);
                    curStress = Fy + (Fu - Fy) * Math.sin(p * Math.PI / 2); 
                } 
                else if (e <= ef) { 
                    const p = (e - eu) / (ef - eu);
                    curStress = Fu - (Fu - 450) * p; 
                } 
                else { curStress = 0; this.failSpecimen('steel'); }
                
                this.testState.stress = curStress;
                
            } else if (isBeam) {
                this.testState.speed = 0.002;
                this.testState.strain += delta * this.testState.speed;
                let e = this.testState.strain;
                
                let fcr = peakStress * 0.15; let ecr = 0.0005;
                let fy = peakStress * 0.8; let ey = 0.005; let eu = 0.025;
                
                if (corrosion > 0.4) {
                    if (e <= ecr) curStress = (e/ecr) * fcr;
                    else { curStress = 0; this.failSpecimen('beam_rebar'); }
                } else {
                    if (e <= ecr) curStress = (e/ecr) * fcr; 
                    else if (e <= ey) curStress = fcr + ((e - ecr)/(ey - ecr)) * (fy - fcr); 
                    else if (e <= eu) curStress = fy + ((e - ey)/(eu - ey)) * (fy * 0.05); 
                    else { curStress = 0; this.failSpecimen('beam_rebar'); }
                }
                this.testState.stress = curStress;
                
            } else {
                this.testState.speed = 0.0005;
                this.testState.strain += delta * this.testState.speed;
                let e = this.testState.strain;
                let isCube = mix.type === 'cube';
                let fc = peakStress * (isCube ? 1.2 : 1.0); 
                let e0 = 0.002; let ecu = isCube ? 0.0035 : 0.003;
                
                if (e <= e0) {
                    curStress = fc * (2 * (e/e0) - Math.pow(e/e0, 2)); 
                } else if (e <= ecu) {
                    curStress = fc * (1 - 0.15 * ((e - e0) / (ecu - e0))); 
                } else {
                    curStress = 0; this.failSpecimen(mix.type); 
                }
                this.testState.stress = curStress;
            }

            if(this.testState.status === 'RUNNING') {
                this.testState.load = this.testState.stress * (isBeam ? 20 : 17.6); 
                this.testState.dataPoints.push({ strain: this.testState.strain, stress: Math.max(0, this.testState.stress) });

                // VISUAL DEFORMATIONS
                if(this.testMesh) {
                    if (isSteel) {
                        const stretch = 1 + this.testState.strain * 1.5; 
                        this.steelTop.scale.set(1, stretch, 1);
                        this.steelBot.scale.set(1, stretch, 1);
                        this.crosshead.position.y = 1.15 + (this.testState.strain * 0.4);
                    } else if (isBeam) {
                        this.crosshead.position.y = 0.79 - (0.8 * this.testState.strain);
                        this.testMesh.position.y = 0.54 - (0.4 * this.testState.strain);
                        this.testMesh.rotation.x = this.testState.strain * 2; 
                    } else {
                        const isCube = mix.type === 'cube';
                        const hOrig = isCube ? 0.15 : 0.3;
                        const heightScale = 1 - this.testState.strain; const bulge = 1 + (this.testState.strain * 0.2); 
                        this.testMesh.scale.set(bulge, heightScale, bulge); 
                        this.testMesh.position.y = 0.45 + (hOrig * heightScale / 2); 
                        this.crosshead.position.y = 0.45 + (hOrig * heightScale) + 0.125;
                    }
                }
                if(this.osState === 'software') this.drawMonitor(true);
            }
        }

        let needsUpdate = false;
        for(let i=0; i<this.debrisParticles.length; i++) {
            let p = this.debrisParticles[i];
            if(p.active) {
                p.vy -= 9.8 * delta * 0.1; 
                p.x += p.vx * delta; p.y += p.vy * delta; p.z += p.vz * delta;
                p.rotX += p.vx; p.rotY += p.vy; p.rotZ += p.vz;
                
                if(p.y < 0.4) { p.y = 0.4; p.vy *= -0.5; p.vx *= 0.8; p.vz *= 0.8; }
                
                this.dummy.position.set(p.x, p.y, p.z);
                this.dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
                this.dummy.updateMatrix();
                this.debrisMesh.setMatrixAt(i, this.dummy.matrix);
                needsUpdate = true;
            }
        }
        if(needsUpdate) this.debrisMesh.instanceMatrix.needsUpdate = true;
    }
}