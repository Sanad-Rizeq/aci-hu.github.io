class NDTStation {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); 
        this.group.position.set(x, 0, z);
        this.uiID = 'ndtUI'; 
        this.name = 'NDT Analysis Center';
        
        this.state = { 
            phase: 'idle', activeTool: null, 
            targetSpecimen: 'beam_rebar', 
            actualStrengthMpa: 35, 
            reboundReadings: [], 
            upvTimeMicrosec: 0,
            upvSignalActive: false, wavePhase: 0,
            gprProgress: 0, gprActive: false,
            xrayActive: false
        };
        
        this.activeApp = 'desktop'; 
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.particles = [];
        this.dummy = new THREE.Object3D();
        this.impactMarks = [];
        
        this.buildMachine(); 
        scene.add(this.group); 
        this.injectExtendedUI();
        this.bindUI();
        
        setInterval(() => this.drawMonitor(), 33); 
    }

    injectExtendedUI() {
        const ndtUI = document.getElementById('ndtUI');
        
        // ASTM D4748
        if(ndtUI && !document.getElementById('btnGPR')) {
            const gprCard = document.createElement('div');
            gprCard.className = 'ndt-method-card';
            gprCard.style.width = '100%';
            gprCard.innerHTML = `
                <h3 style="margin: 0 0 5px 0; font-family: 'JetBrains Mono'; font-size: 16px; color: var(--lab-accent);">Ground Penetrating Radar</h3>
                <p style="font-size: 12px; color: #94a3b8; margin-top: 0; margin-bottom: 15px;">ASTM D4748 - Subsurface Rebar Location</p>
                <button id="btnGPR" style="border-color: #a855f7; width:100%; padding: 12px 15px; font-weight: bold; border-radius: 8px; background: rgba(0, 217, 255, 0.1); color: white; cursor: pointer; text-transform: uppercase; font-family: 'Space Grotesk';">Run B-Scan</button>
            `;
            ndtUI.appendChild(gprCard);
        }

        if(ndtUI && !document.getElementById('btnXRay')) {
            const xrayCard = document.createElement('div');
            xrayCard.className = 'ndt-method-card';
            xrayCard.style.width = '100%';
            xrayCard.innerHTML = `
                <h3 style="margin: 0 0 5px 0; font-family: 'JetBrains Mono'; font-size: 16px; color: #f59e0b;">Diagnostics / X-Ray</h3>
                <p style="font-size: 12px; color: #94a3b8; margin-top: 0; margin-bottom: 15px;">Verify internal steel visually.</p>
                <button id="btnXRay" style="border-color: #f59e0b; width:100%; padding: 12px 15px; font-weight: bold; border-radius: 8px; background: rgba(245, 158, 11, 0.1); color: white; cursor: pointer; text-transform: uppercase; font-family: 'Space Grotesk';">Toggle X-Ray Vision</button>
            `;
            ndtUI.appendChild(xrayCard);
        }
    }

    buildMachine() {
        this.group.add(createAntiVibrationMat(2.5, 2.5));
        const steelMat = new THREE.MeshPhysicalMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2 });
        const deskMat = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, roughness: 0.8 });
        const upvMat = new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, metalness: 0.4, roughness: 0.3, clearcoat: 0.5 });
        const gprMat = new THREE.MeshPhysicalMaterial({ color: 0xa855f7, metalness: 0.2, roughness: 0.5, clearcoat: 0.2 });

        this.concreteMat = new THREE.MeshPhysicalMaterial({ map: createNoiseTexture('#64748b'), roughness: 0.9, metalness: 0.1 });
        this.rebarMat = new THREE.MeshPhysicalMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.3 });

        const desk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.8), deskMat);
        desk.position.y = 0.45; desk.castShadow = true; this.group.add(desk);

        const canvas = document.getElementById('ndtMonitorCanvas');
        this.ctx = canvas.getContext('2d'); 
        this.screenTex = new THREE.CanvasTexture(canvas);

        const monitorGroup = new THREE.Group();
        monitorGroup.position.set(-0.7, 0.9, -0.6); 
        monitorGroup.rotation.y = Math.PI / 8;
        this.group.add(monitorGroup);

        const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.25), deskMat);
        base.position.y = 0.01; base.castShadow = true; monitorGroup.add(base);
        
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.3), deskMat);
        neck.position.set(0, 0.15, -0.05); neck.castShadow = true; monitorGroup.add(neck);

        const screenBox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.05), new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.8}));
        screenBox.position.set(0, 0.35, 0); screenBox.castShadow = true; monitorGroup.add(screenBox);

        const display = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshBasicMaterial({map: this.screenTex}));
        display.position.set(0, 0.35, 0.026); 
        display.userData.isNDTMonitor = true; 
        monitorGroup.add(display);

        // ASTM C597
        this.transL = new THREE.Group(); this.group.add(this.transL);
        const bodyL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08), new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.7 }));
        bodyL.rotation.z = Math.PI/2; this.transL.add(bodyL);
        const contactL = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.01), steelMat);
        contactL.rotation.z = Math.PI/2; contactL.position.x = 0.04; this.transL.add(contactL);
        this.transL.position.set(-0.2, 0.95, -0.2);

        this.transR = new THREE.Group(); this.group.add(this.transR);
        const bodyR = bodyL.clone(); this.transR.add(bodyR);
        const contactR = contactL.clone(); contactR.position.x = -0.04; this.transR.add(contactR);
        this.transR.position.set(0.2, 0.95, -0.2);

        // ASTM C805
        this.hammer = new THREE.Group(); this.group.add(this.hammer);
        const hBody = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25), new THREE.MeshStandardMaterial({color: 0xfacc15}));
        hBody.rotation.x = Math.PI/2; this.hammer.add(hBody);
        this.plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05), steelMat);
        this.plunger.position.z = 0.13; this.hammer.add(this.plunger);
        this.hammer.position.set(0.8, 0.92, 0.5);

        this.gprScanner = new THREE.Group(); this.group.add(this.gprScanner);
        const gprBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.12), gprMat);
        gprBody.position.y = 0.04; this.gprScanner.add(gprBody);
        const gprHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1), new THREE.MeshStandardMaterial({color: 0x111}));
        gprHandle.rotation.x = Math.PI/2; gprHandle.position.set(0, 0.1, 0); this.gprScanner.add(gprHandle);
        this.gprScanner.position.set(0.5, 0.9, 0.5);

        this.specimenGroup = new THREE.Group();
        this.group.add(this.specimenGroup);
        
        this.loadStandardSpecimen('beam_rebar');

        this.particleMat = new THREE.MeshStandardMaterial({color: 0x94a3b8, transparent: true, opacity: 0.8});
        this.dustMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.005, 8, 8), this.particleMat, 20);
        this.group.add(this.dustMesh);
        for(let i=0; i<20; i++) { this.particles.push({ active: false, x:0, y:0, z:0, vx:0, vy:0, vz:0, life:0 }); }
    }

    loadStandardSpecimen(type) {
        while(this.specimenGroup.children.length > 0){ this.specimenGroup.remove(this.specimenGroup.children[0]); }
        this.impactMarks.forEach(m => this.group.remove(m)); this.impactMarks = [];
        this.state.targetSpecimen = type;
        this.state.reboundReadings = []; this.state.upvTimeMicrosec = 0;

        if (type === 'beam_rebar') {
            // Beam: 800 x 200 x 200 mm
            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.2), this.concreteMat);
            beam.position.set(0.2, 1.0, 0); beam.castShadow = true; this.specimenGroup.add(beam);
            
            // Rebar: 12 mm dia
            for (let i = 0; i < 4; i++) {
                const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.78), this.rebarMat);
                bar.rotation.z = Math.PI/2;
                bar.position.set(0.2, 1.0 + (i<2?0.06:-0.06), (i%2===0?0.06:-0.06));
                this.specimenGroup.add(bar);
            }
            // Stirrups: 8 mm dia @ 100mm spacing
            for (let i = -0.35; i <= 0.35; i += 0.1) {
                const stirrup = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.14, 0.14), this.rebarMat);
                stirrup.position.set(0.2 + i, 1.0, 0); this.specimenGroup.add(stirrup);
            }
            this.state.actualStrengthMpa = 35;
        } else if (type === 'column') {
            // Column: 800 x 250 x 250 mm
            const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.25), this.concreteMat);
            col.position.set(0.2, 1.025, 0); col.castShadow = true; this.specimenGroup.add(col);
            
            // Rebar: 16 mm dia
            const offsets = [
                {y: 0.08, z: 0.08}, {y: 0.08, z: 0}, {y: 0.08, z: -0.08},
                {y: -0.08, z: 0.08}, {y: -0.08, z: 0}, {y: -0.08, z: -0.08}
            ];
            offsets.forEach(off => {
                const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.78), this.rebarMat);
                bar.rotation.z = Math.PI/2;
                bar.position.set(0.2, 1.025 + off.y, off.z);
                this.specimenGroup.add(bar);
            });
            
            // Stirrups: 8 mm dia @ 80mm spacing
            for (let i = -0.35; i <= 0.35; i += 0.08) {
                const stirrup = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.18, 0.18), this.rebarMat);
                stirrup.position.set(0.2 + i, 1.025, 0); this.specimenGroup.add(stirrup);
            }
            this.state.actualStrengthMpa = 45;
        }
    }

    loadInventorySpecimen(mix) {
        while(this.specimenGroup.children.length > 0){ this.specimenGroup.remove(this.specimenGroup.children[0]); }
        this.impactMarks.forEach(m => this.group.remove(m)); this.impactMarks = [];
        this.state.targetSpecimen = mix.id;
        this.state.actualStrengthMpa = mix.currentFc || 30;

        // Cylinder: 150 x 300 mm | Cube: 150 x 150 x 150 mm
        const isCyl = mix.type === 'cylinder';
        const mesh = new THREE.Mesh(isCyl ? new THREE.CylinderGeometry(0.075, 0.075, 0.3, 32) : new THREE.BoxGeometry(0.15, 0.15, 0.15), this.concreteMat);
        mesh.position.set(0.4, isCyl ? 0.6 : 0.525, 0); mesh.castShadow = true;
        this.specimenGroup.add(mesh);
    }

    getSpecimenTestingCoords() {
        if (this.state.targetSpecimen === 'beam_rebar') {
            return { hitY: 1.1, hitX: 0.2, hitZ: 0, w: 0.2, h: 0.2, hamRot: [Math.PI/2, 0, 0], gprY: 1.1, gprStartX: -0.2, gprEndX: 0.6 };
        } else if (this.state.targetSpecimen === 'column') {
            return { hitY: 1.15, hitX: 0.2, hitZ: 0, w: 0.25, h: 0.25, hamRot: [Math.PI/2, 0, 0], gprY: 1.15, gprStartX: -0.2, gprEndX: 0.6 };
        } else {
            return { hitY: 0.6, hitX: 0.4, hitZ: 0, w: 0.15, h: 0.15, hamRot: [Math.PI/2, 0, 0] };
        }
    }

    playImpactSound() {
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(600, this.audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(1.0, this.audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        osc.connect(gain); gain.connect(this.audioCtx.destination); osc.start(); osc.stop(this.audioCtx.currentTime + 0.1);
    }

    playScanSound() {
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, this.audioCtx.currentTime); 
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 3.0); gain.gain.linearRampToValueAtTime(0.0, this.audioCtx.currentTime + 3.1);
        osc.connect(gain); gain.connect(this.audioCtx.destination); osc.start(); osc.stop(this.audioCtx.currentTime + 3.1);
    }

    triggerDust(x,y,z) {
        this.particles.forEach(p => {
            p.active = true; p.life = 1.0; p.x = x; p.y = y; p.z = z;
            p.vx = (Math.random() - 0.5) * 0.1; p.vy = Math.random() * 0.1; p.vz = (Math.random() - 0.5) * 0.1;
        });
    }

    runGPRTest() {
        if (this.state.activeTool) return;
        if (this.state.targetSpecimen !== 'beam_rebar' && this.state.targetSpecimen !== 'column') { 
            alert("GPR Scanning is only configured for the Structural Elements in this lab."); return; 
        }
        
        this.state.activeTool = 'gpr';
        this.activeApp = 'gpr';
        this.state.gprActive = true;
        this.state.gprProgress = 0;
        
        const coords = this.getSpecimenTestingCoords();
        
        gsap.to(this.gprScanner.position, { x: coords.gprStartX, y: coords.gprY, z: 0, duration: 0.5, onComplete: () => {
            this.playScanSound();
            gsap.to(this.gprScanner.position, { x: coords.gprEndX, duration: 3.0, ease: "linear", onUpdate: () => {
                this.state.gprProgress = (this.gprScanner.position.x - coords.gprStartX) / (coords.gprEndX - coords.gprStartX);
            }, onComplete: () => {
                this.state.gprActive = false;
                gsap.to(this.gprScanner.position, { x: 0.5, y: 0.9, z: 0.5, duration: 0.8, delay: 1.0, onComplete: () => this.state.activeTool = null });
            }});
        }});
    }

    runSchmidtTest() {
        if (this.state.reboundReadings.length >= 10) return;
        if (this.state.activeTool) return;
        this.state.activeTool = 'schmidt';
        this.activeApp = 'schmidt';
        
        const coords = this.getSpecimenTestingCoords();
        const count = this.state.reboundReadings.length;
        const dx = ( (count % 3) - 1 ) * 0.04;
        const dz = ( Math.floor(count / 3) - 1 ) * 0.04;
        const targetPos = { x: coords.hitX + dx, y: coords.hitY, z: coords.hitZ + dz };

        gsap.to(this.hammer.position, { x: targetPos.x, y: targetPos.y + 0.2, z: targetPos.z, duration: 0.5, onComplete: () => {
            this.hammer.rotation.set(...coords.hamRot);
            gsap.to(this.hammer.position, { y: targetPos.y + 0.13, duration: 0.06, ease: "power1.in", onComplete: () => {
                this.playImpactSound();
                this.triggerDust(targetPos.x, targetPos.y, targetPos.z);
                
                const mark = new THREE.Mesh(new THREE.CircleGeometry(0.005, 8), new THREE.MeshBasicMaterial({color: 0x334155}));
                mark.rotation.x = -Math.PI/2; mark.position.set(targetPos.x, targetPos.y + 0.001, targetPos.z);
                this.group.add(mark); this.impactMarks.push(mark);

                const variance = Math.random()*6-3;
                const reading = Math.round((this.state.actualStrengthMpa + 15)/1.5 + variance);
                this.state.reboundReadings.push({val: reading, x: count%3, y: Math.floor(count/3)});

                gsap.to(this.hammer.position, { x: 0.8, y: 0.92, z: 0.5, duration: 0.6, delay: 0.2, onStart: () => this.hammer.rotation.set(Math.PI/2, 0, 0), onComplete: () => this.state.activeTool = null });
            }});
        }});
    }

    runUPVTest() {
        if (this.state.activeTool) return;
        this.state.activeTool = 'upv';
        this.activeApp = 'upv';
        const coords = this.getSpecimenTestingCoords();
        const faceL = coords.hitX - (coords.w/2); const faceR = coords.hitX + (coords.w/2);

        gsap.to(this.transL.position, { x: faceL - 0.04, y: coords.hitY, z: coords.hitZ, duration: 0.8 });
        gsap.to(this.transR.position, { x: faceR + 0.04, y: coords.hitY, z: coords.hitZ, duration: 0.8, onComplete: () => {
            
            if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
            const osc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(3000, this.audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(1000, this.audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.5, this.audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
            osc.connect(gain); gain.connect(this.audioCtx.destination); osc.start(); osc.stop(this.audioCtx.currentTime + 0.1);

            this.state.upvSignalActive = true;

            setTimeout(() => {
                this.state.upvSignalActive = false;
                
                // ASTM C597 Velocity Reference
                let velocity = 4200; 
                if (this.state.targetSpecimen === 'beam_rebar' && Math.abs(coords.hitZ) < 0.08) {
                    velocity = 4800;
                } else if (this.state.targetSpecimen === 'column') {
                    velocity = 5000;
                }
                
                this.state.upvTimeMicrosec = ( (coords.w / (velocity/1000000)) + (Math.random()*1.5) ).toFixed(1);
                
                gsap.to(this.transL.position, { x: -0.2, y: 0.95, z: -0.2, duration: 0.8 });
                gsap.to(this.transR.position, { x: 0.2, y: 0.95, z: -0.2, duration: 0.8, onComplete: () => this.state.activeTool = null });
            }, 2000);
        }});
    }

    drawMonitor() {
        this.state.wavePhase += 0.4;
        
        this.ctx.fillStyle = '#0f172a'; this.ctx.fillRect(0,0,800,600);
        this.ctx.fillStyle = '#1e3a8a'; this.ctx.fillRect(0,0,800,40);
        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 20px Arial'; this.ctx.textAlign='left'; 
        this.ctx.fillText('NDT PRO-SUITE v4.0', 20, 28);

        const apps = [
            {id: 'desktop', name: 'HOME', x: 250},
            {id: 'schmidt', name: 'SCHMIDT 2D', x: 350},
            {id: 'upv', name: 'UPV SCOPE', x: 500},
            {id: 'gpr', name: 'GPR B-SCAN', x: 650}
        ];
        apps.forEach(app => {
            this.ctx.fillStyle = this.activeApp === app.id ? '#38bdf8' : '#1e293b';
            this.ctx.fillRect(app.x, 5, 130, 30);
            this.ctx.fillStyle = this.activeApp === app.id ? '#0f172a' : '#cbd5e1';
            this.ctx.font = 'bold 12px Arial'; this.ctx.textAlign = 'center';
            this.ctx.fillText(app.name, app.x + 65, 25);
        });

        if (this.activeApp === 'desktop') {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; this.ctx.lineWidth = 1;
            for(let i=0; i<800; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(i,40); this.ctx.lineTo(i,600); this.ctx.stroke(); }
            for(let i=40; i<600; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(0,i); this.ctx.lineTo(800,i); this.ctx.stroke(); }
            
            this.ctx.fillStyle = '#38bdf8'; this.ctx.font = 'bold 32px Arial'; this.ctx.textAlign = 'center';
            this.ctx.fillText('SELECT A DIAGNOSTIC TOOL', 400, 300);
        }
        else if (this.activeApp === 'schmidt') {
            this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(50, 80, 700, 480);
            this.ctx.fillStyle = '#cbd5e1'; this.ctx.font = '18px Arial'; this.ctx.textAlign = 'left';
            this.ctx.fillText('SURFACE HARDNESS HEATMAP (ASTM C805)', 70, 110);
            
            const gx = 250, gy = 150, cell = 100;
            this.ctx.strokeStyle = '#334155'; this.ctx.lineWidth = 2;
            for(let r=0; r<4; r++) {
                for(let c=0; c<3; c++) {
                    this.ctx.strokeRect(gx + c*cell, gy + r*cell, cell, cell);
                }
            }
            
            let sum = 0;
            this.state.reboundReadings.forEach(rd => {
                let hue = Math.max(0, Math.min(240, (rd.val - 20) * 8)); 
                this.ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.8)`;
                this.ctx.fillRect(gx + rd.x*cell + 2, gy + rd.y*cell + 2, cell-4, cell-4);
                
                this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 24px monospace'; this.ctx.textAlign = 'center';
                this.ctx.fillText(rd.val, gx + rd.x*cell + cell/2, gy + rd.y*cell + cell/2 + 8);
                sum += rd.val;
            });
            
            if(this.state.reboundReadings.length > 0) {
                this.ctx.fillStyle = '#38bdf8'; this.ctx.textAlign = 'left';
                this.ctx.fillText(`AVERAGE R-VALUE: ${(sum/this.state.reboundReadings.length).toFixed(1)}`, 70, 520);
            }
        }
        else if (this.activeApp === 'upv') {
            this.ctx.fillStyle = '#020617'; this.ctx.fillRect(50, 80, 700, 350);
            this.ctx.strokeStyle = '#334155'; this.ctx.lineWidth = 1;
            for(let x=50; x<=750; x+=50) { this.ctx.beginPath(); this.ctx.moveTo(x, 80); this.ctx.lineTo(x, 430); this.ctx.stroke(); }
            for(let y=80; y<=430; y+=50) { this.ctx.beginPath(); this.ctx.moveTo(50, y); this.ctx.lineTo(750, y); this.ctx.stroke(); }
            
            this.ctx.beginPath(); this.ctx.strokeStyle = '#10b981'; this.ctx.lineWidth = 2;
            
            if (this.state.upvSignalActive) {
                for(let x=0; x<=700; x+=2) {
                    let y = 255 + (Math.random() - 0.5) * 20;
                    if(x===0) this.ctx.moveTo(x+50, y); else this.ctx.lineTo(x+50, y);
                }
                this.ctx.stroke();
            } else if (this.state.upvTimeMicrosec > 0) {
                const arrivalX = parseFloat(this.state.upvTimeMicrosec) * 7.0; 
                for(let x=0; x<=700; x+=2) {
                    let y = 255;
                    if (x < arrivalX) {
                        y += (Math.random() - 0.5) * 4; 
                    } else {
                        const t = x - arrivalX;
                        y += Math.sin(t * 0.2) * 120 * Math.exp(-t * 0.015) + (Math.random()-0.5)*2;
                    }
                    if(x===0) this.ctx.moveTo(x+50, y); else this.ctx.lineTo(x+50, y);
                }
                this.ctx.stroke();
                
                this.ctx.beginPath(); this.ctx.strokeStyle = '#ef4444'; this.ctx.lineWidth = 1;
                this.ctx.moveTo(50 + arrivalX, 80); this.ctx.lineTo(50 + arrivalX, 430);
                this.ctx.stroke();
            } else {
                this.ctx.moveTo(50, 255); this.ctx.lineTo(750, 255);
                this.ctx.stroke();
            }

            this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(50, 450, 700, 100);
            this.ctx.fillStyle = '#38bdf8'; this.ctx.font = 'bold 24px monospace'; this.ctx.textAlign='center';
            let txt = this.state.upvSignalActive ? 'SCANNING PULSE...' : `TRANSIT TIME: ${this.state.upvTimeMicrosec} µs`;
            this.ctx.fillText(txt, 400, 510);
        }
        else if (this.activeApp === 'gpr') {
            this.ctx.fillStyle = '#000'; this.ctx.fillRect(50, 80, 700, 400);
            
            this.ctx.strokeStyle = '#334155'; this.ctx.lineWidth = 1;
            for(let y=80; y<480; y+=50) { this.ctx.beginPath(); this.ctx.moveTo(50,y); this.ctx.lineTo(750,y); this.ctx.stroke(); }
            
            const currentX = 50 + (700 * this.state.gprProgress);
            
            this.ctx.fillStyle = 'rgba(255,255,255,0.02)';
            for(let i=0; i<20; i++) {
                this.ctx.fillRect(50, 80 + Math.random()*380, currentX - 50, Math.random()*20);
            }
            
            if (this.state.gprProgress > 0) {
                let stirrups = [];
                if (this.state.targetSpecimen === 'beam_rebar') stirrups = [-0.35, -0.25, -0.15, -0.05, 0.05, 0.15, 0.25, 0.35];
                else if (this.state.targetSpecimen === 'column') {
                    for(let i=-0.35; i<=0.35; i+=0.08) stirrups.push(i);
                }

                stirrups.forEach(st => {
                    const canvasStX = 50 + ((st + 0.4) / 0.8) * 700;
                    if (currentX > canvasStX - 100) {
                        
                        const drawBand = (offsetY, color, width, intensity) => {
                            this.ctx.beginPath();
                            this.ctx.strokeStyle = color;
                            this.ctx.lineWidth = width;
                            for(let x = canvasStX - 100; x < canvasStX + 100; x+=2) {
                                if (x > currentX || x < 50 || x > 750) continue;
                                let dist = Math.abs(x - canvasStX);
                                let depth = Math.sqrt(3000 + Math.pow(dist * 1.5, 2));
                                let y = 100 + depth + offsetY;
                                
                                let alpha = Math.max(0, 1 - (dist / 100)) * intensity;
                                this.ctx.globalAlpha = alpha;
                                
                                if (x === canvasStX - 100) this.ctx.moveTo(x, y);
                                else this.ctx.lineTo(x, y + (Math.random()-0.5)*2);
                            }
                            this.ctx.stroke();
                            this.ctx.globalAlpha = 1.0;
                        };

                        drawBand(0, '#ffffff', 3, 0.9);
                        drawBand(12, '#000000', 4, 0.8);
                        drawBand(20, '#ffffff', 2, 0.6);
                        drawBand(30, '#000000', 3, 0.5);
                        drawBand(40, '#ffffff', 1, 0.3);
                    }
                });
            }

            if (this.state.gprActive) {
                this.ctx.fillStyle = 'rgba(255,255,255,0.05)';
                this.ctx.fillRect(50, 80, currentX - 50, 400);
                this.ctx.strokeStyle = '#ef4444'; this.ctx.lineWidth = 2;
                this.ctx.beginPath(); this.ctx.moveTo(currentX, 80); this.ctx.lineTo(currentX, 480); this.ctx.stroke();
            }

            this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(50, 490, 700, 80);
            this.ctx.fillStyle = '#eab308'; this.ctx.font = 'bold 20px monospace'; this.ctx.textAlign='center';
            let txt = this.state.gprActive ? 'TRANSMITTING RADAR...' : (this.state.gprProgress > 0 ? 'SCAN COMPLETE - REBAR DETECTED' : 'AWAITING SCAN');
            this.ctx.fillText(txt, 400, 535);
        }

        this.screenTex.needsUpdate = true;
    }

    bindUI() {
        const canvas = document.getElementById('ndtMonitorCanvas');
        if(canvas) {
            canvas.addEventListener('click', (e) => {
                if(canvas.style.display !== 'block') return;
                const rect = canvas.getBoundingClientRect(); 
                const x = (e.clientX - rect.left) * (canvas.width / rect.width); 
                const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                
                if (y < 40) {
                    if (x > 250 && x < 380) this.activeApp = 'desktop';
                    if (x > 350 && x < 480) this.activeApp = 'schmidt';
                    if (x > 500 && x < 630) this.activeApp = 'upv';
                    if (x > 650 && x < 780) this.activeApp = 'gpr';
                    this.drawMonitor();
                }
            });
        }

        window.addEventListener('inventoryUpdate', () => {
            const select = document.getElementById('ndtSpecimenSelect');
            if(!select) return;
            Array.from(select.options).forEach(opt => { if(opt.value.startsWith('inv_')) select.remove(opt.index); });
            window.LabState.inventory.forEach(mix => {
                const opt = document.createElement('option'); opt.value = `inv_${mix.id}`; opt.text = `Lab: ${mix.name}`; select.add(opt);
            });
        });

        const specSelect = document.getElementById('ndtSpecimenSelect');
        if(specSelect) {
            specSelect.innerHTML = `<option value="beam_rebar">Reinforced Beam (Default)</option><option value="column">Structural Column (Default)</option>`;
            specSelect.onchange = (e) => { 
                const val = e.target.value;
                if(val.startsWith('inv_')) {
                    const mix = window.LabState.inventory.find(m => m.id === val.split('_')[1]);
                    if(mix) this.loadInventorySpecimen(mix);
                } else { this.loadStandardSpecimen(val); }
                this.activeApp = 'desktop'; 
            };
        }
        
        document.getElementById('btnSchmidt').onclick = () => this.runSchmidtTest();
        document.getElementById('btnUPV').onclick = () => this.runUPVTest();
        
        document.addEventListener('click', (e) => {
            if(e.target && e.target.id === 'btnGPR') {
                this.runGPRTest();
            }
            if(e.target && e.target.id === 'btnXRay') {
                this.state.xrayActive = !this.state.xrayActive;
                this.concreteMat.transparent = true;
                this.concreteMat.opacity = this.state.xrayActive ? 0.25 : 1.0;
                this.concreteMat.needsUpdate = true;
                e.target.style.background = this.state.xrayActive ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.1)';
            }
        });
    }

    update(delta) {
        let needsUpdate = false;
        for(let i=0; i<this.particles.length; i++) {
            let p = this.particles[i];
            if(p.active) {
                p.life -= delta * 2;
                if(p.life <= 0) { p.active = false; this.dummy.position.set(0,-100,0); }
                else {
                    p.vy -= 9.8 * delta * 0.1; 
                    p.x += p.vx; p.y += p.vy; p.z += p.vz;
                    this.dummy.position.set(p.x, p.y, p.z);
                    this.dummy.scale.setScalar(p.life); 
                }
                this.dummy.updateMatrix();
                this.dustMesh.setMatrixAt(i, this.dummy.matrix);
                needsUpdate = true;
            }
        }
        if(needsUpdate) this.dustMesh.instanceMatrix.needsUpdate = true;
    }
}