class LAStation {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); this.group.position.set(x, 0, z);
        this.uiID = 'laUI'; this.uiVisible = false; this.name = 'LA Abrasion';
        
        this.state = { phase: 'idle', revs: 0, targetRevs: 500, hasAgg: false, hasSteel: false, fastMode: false, doorsOpen: true, grading: 'A (12 Spheres)' }; 
        this.osState = 'desktop'; 
        this.spheres = [];
        
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.noiseNode = null;
        
        this.buildMachine(); 
        scene.add(this.group); 
        this.bindUI();
        
        setInterval(() => { this.drawMonitor(this.state.phase === 'done'); }, 1000);
    }

    playClankSound() {
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        if(this.noiseNode) return;
        
        const bufferSize = this.audioCtx.sampleRate * 2; 
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
        
        this.noiseNode = this.audioCtx.createBufferSource();
        this.noiseNode.buffer = buffer;
        this.noiseNode.loop = true;
        
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass'; filter.frequency.value = 1000; filter.Q.value = 1.5;
        
        const gain = this.audioCtx.createGain();
        gain.gain.value = 0.4;
        
        this.noiseNode.connect(filter); filter.connect(gain); gain.connect(this.audioCtx.destination);
        this.noiseNode.start();
    }

    stopClankSound() {
        if(this.noiseNode) { this.noiseNode.stop(); this.noiseNode.disconnect(); this.noiseNode = null; }
    }

    buildMachine() {
        this.group.add(createAntiVibrationMat(2.5, 2.5));

        const matBlueFrame = new THREE.MeshPhysicalMaterial({ color: 0x1e3a8a, metalness: 0.5, roughness: 0.6, clearcoat: 0.1 }); 
        const matDrumSteel = new THREE.MeshPhysicalMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.5, clearcoat: 0.2, side: THREE.DoubleSide }); 
        const matSphere = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 1.0, roughness: 0.1, clearcoat: 1.0 });
        const matGlass = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.2, metalness: 0.9, roughness: 0.1, clearcoat: 1.0 });
        const matRubber = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.9 });

        const encBack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.1), matBlueFrame); encBack.position.set(0, 1.1, -0.7); encBack.castShadow = true; this.group.add(encBack);
        const encTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.4), matBlueFrame); encTop.position.set(0, 2.25, 0); this.group.add(encTop);
        const encL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 1.4), matBlueFrame); encL.position.set(-0.75, 1.1, 0); encL.castShadow = true; this.group.add(encL);
        const encR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 1.4), matBlueFrame); encR.position.set(0.75, 1.1, 0); encR.castShadow = true; this.group.add(encR);

        this.doorL = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.0, 0.05), matGlass); 
        this.doorL.position.set(-0.375, 1.1, 0.7); this.doorL.geometry.translate(0.375, 0, 0); this.doorL.rotation.y = -Math.PI / 1.5; this.group.add(this.doorL);
        
        this.doorR = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.0, 0.05), matGlass); 
        this.doorR.position.set(0.375, 1.1, 0.7); this.doorR.geometry.translate(-0.375, 0, 0); this.doorR.rotation.y = Math.PI / 1.5; this.group.add(this.doorR);

        const pan = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 1.0), matDrumSteel); pan.position.y = 0.125; this.group.add(pan);
        
        this.drum = new THREE.Group(); this.drum.position.set(0, 1.2, 0); this.group.add(this.drum);
        
        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 32, 1, false, 0, Math.PI * 1.7), matDrumSteel); 
        cylinder.rotation.z = Math.PI / 2; cylinder.castShadow = true; this.drum.add(cylinder);
        
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.15), matDrumSteel);
        shelf.position.set(0, 0.35, 0.1); shelf.rotation.x = -Math.PI/6; this.drum.add(shelf);

        const drumCap1 = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), matDrumSteel); drumCap1.position.x = -0.4; drumCap1.rotation.y = -Math.PI/2; this.drum.add(drumCap1);
        const drumCap2 = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), matDrumSteel); drumCap2.position.x = 0.4; drumCap2.rotation.y = Math.PI/2; this.drum.add(drumCap2);

        const motorBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.4), matBlueFrame); motorBox.position.set(0.9, 1.2, 0); this.group.add(motorBox);
        const beltCover = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.2), matRubber); beltCover.position.set(0.75, 1.2, 0); this.group.add(beltCover);

        for(let i=0; i<12; i++) { 
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.045, 32, 32), matSphere); 
            sphere.visible = false; sphere.castShadow = true; this.drum.add(sphere); 
            this.spheres.push({ mesh: sphere, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }); 
        }

        const desk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.6), new THREE.MeshStandardMaterial({color: 0x111})); desk.position.set(1.8, 0.4, 0.7); desk.castShadow = true; this.group.add(desk);
        const canvas = document.getElementById('laMonitorCanvas'); this.ctx = canvas.getContext('2d'); this.screenTexture = new THREE.CanvasTexture(canvas);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ map: this.screenTexture })); screen.position.set(1.8, 1.15, 0.7); screen.rotation.y = -Math.PI / 4; screen.userData.isLAMonitor = true; this.group.add(screen);
    }

    drawMonitor(isDone = false) {
        if (this.osState === 'desktop') {
            const grad = this.ctx.createLinearGradient(0, 0, 800, 600);
            grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#1e3a8a');
            this.ctx.fillStyle = grad; this.ctx.fillRect(0,0,800,600);
            
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'; this.ctx.lineWidth = 1;
            for(let i=0; i<800; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(i,0); this.ctx.lineTo(i,600); this.ctx.stroke(); }
            for(let i=0; i<600; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(0,i); this.ctx.lineTo(800,i); this.ctx.stroke(); }

            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; this.ctx.fillRect(30, 30, 80, 80);
            this.ctx.fillStyle = '#eab308'; this.ctx.beginPath(); this.ctx.arc(70, 70, 25, 0, Math.PI*2); this.ctx.fill();
            this.ctx.fillStyle = '#fff'; this.ctx.beginPath(); this.ctx.arc(70, 70, 15, 0, Math.PI*2); this.ctx.fill();
            this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '12px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('Abrasion_OS.exe', 70, 130);

            this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; this.ctx.fillRect(0, 560, 800, 40);
            this.ctx.fillStyle = '#38bdf8'; this.ctx.fillRect(10, 565, 40, 30);
            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('ACI', 30, 586);
            const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '14px Arial'; this.ctx.textAlign = 'right'; this.ctx.fillText(timeString, 780, 585);
            this.screenTexture.needsUpdate = true; return;
        }

        this.ctx.fillStyle = '#0f172a'; this.ctx.fillRect(0, 0, 800, 600); 
        this.ctx.fillStyle = '#1e3a8a'; this.ctx.fillRect(0, 0, 800, 40);
        this.ctx.fillStyle = '#ffffff'; this.ctx.font = 'bold 18px Arial'; this.ctx.textAlign = 'left'; this.ctx.fillText('LOS ANGELES ABRASION MACHINE (ASTM C131)', 10, 26);
        this.ctx.fillStyle = '#dc2626'; this.ctx.fillRect(760, 0, 40, 40); this.ctx.fillStyle = '#fff'; this.ctx.textAlign = 'center'; this.ctx.fillText('X', 780, 26);

        this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(20, 60, 760, 520);

        if(this.state.phase === 'idle') { 
            this.ctx.fillStyle = '#3b82f6'; this.ctx.fillRect(40, 80, 720, 60);
            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 20px Arial'; this.ctx.textAlign='left'; 
            this.ctx.fillText(`CURRENT CONFIGURATION: GRADING ${this.state.grading}`, 60, 118);

            this.ctx.fillStyle = '#f59e0b'; this.ctx.font = 'bold 32px monospace'; this.ctx.textAlign='center'; 
            this.ctx.fillText('MACHINE IDLE - AWAITING LOAD', 400, 300); 

            const alpha = 0.5 + Math.sin(Date.now() / 200) * 0.5;
            this.ctx.fillStyle = `rgba(234, 179, 8, ${alpha})`;
            this.ctx.beginPath(); this.ctx.arc(400, 350, 20, 0, Math.PI*2); this.ctx.fill();

        } else if (this.state.phase === 'running') {
            this.ctx.fillStyle = '#22c55e'; this.ctx.font = 'bold 40px monospace'; this.ctx.textAlign='center'; 
            this.ctx.fillText(`MACHINE RUNNING`, 400, 150); 
            
            this.ctx.fillStyle = '#0f172a'; this.ctx.fillRect(100, 250, 600, 40);
            const progress = Math.min(1.0, this.state.revs / this.state.targetRevs);
            this.ctx.fillStyle = '#22c55e'; this.ctx.fillRect(104, 254, 592 * progress, 32);
            
            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 24px monospace'; 
            this.ctx.fillText(`REV: ${Math.floor(this.state.revs)} / ${this.state.targetRevs}`, 400, 220); 
            
            // ASTM C131: 30 to 33 RPM
            this.ctx.strokeStyle = '#334155'; this.ctx.lineWidth = 10; this.ctx.beginPath(); this.ctx.arc(400, 420, 80, Math.PI, 0); this.ctx.stroke();
            this.ctx.strokeStyle = '#38bdf8'; this.ctx.beginPath(); this.ctx.arc(400, 420, 80, Math.PI, Math.PI + (Math.PI * 0.7)); this.ctx.stroke(); 
            this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '16px Arial'; this.ctx.fillText('SPEED: 33 RPM', 400, 450);

            if(this.state.fastMode) { 
                this.ctx.fillStyle = '#ef4444'; this.ctx.font = 'bold 20px Arial'; 
                this.ctx.fillText(`FAST FORWARD >>`, 400, 500); 
            }
        } else if (isDone) {
            this.ctx.fillStyle = '#38bdf8'; this.ctx.font = 'bold 24px Arial'; this.ctx.textAlign='left'; 
            this.ctx.fillText(`POST-TEST ANALYSIS`, 50, 120);
            
            this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '20px monospace';
            this.ctx.fillText(`Original Sample Mass (A): 5000 g`, 50, 180);
            
            const lossPct = 20 + Math.random() * 25; 
            const finalMass = 5000 * (1 - (lossPct/100));
            this.ctx.fillText(`Final Mass > 1.70mm (B):  ${finalMass.toFixed(0)} g`, 50, 230);
            
            this.ctx.fillStyle = '#1e3a8a'; this.ctx.fillRect(50, 280, 700, 80); 
            this.ctx.fillStyle = '#eab308'; this.ctx.font = 'bold 36px Arial'; 
            this.ctx.fillText(`ABRASION LOSS: ${lossPct.toFixed(1)} %`, 70, 335);

            if(lossPct > 40) { 
                this.ctx.fillStyle = '#ef4444'; this.ctx.font = 'bold 24px Arial'; 
                this.ctx.fillText(`STATUS: REJECTED (Fails max 40% standard)`, 50, 420); 
            } else { 
                this.ctx.fillStyle = '#4ade80'; this.ctx.font = 'bold 24px Arial'; 
                this.ctx.fillText(`STATUS: APPROVED (Durable Aggregate)`, 50, 420); 
            }
            
            this.ctx.fillStyle = '#10b981'; this.ctx.fillRect(250, 480, 300, 50); 
            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 20px Arial'; this.ctx.textAlign = 'center'; 
            this.ctx.fillText('💾 EXPORT ASTM REPORT', 400, 512);
        }
        this.screenTexture.needsUpdate = true;
    }

    bindUI() {
        const canvas = document.getElementById('laMonitorCanvas');
        canvas.addEventListener('dblclick', (e) => { 
            if(canvas.style.display === 'block' && this.osState === 'desktop') { this.osState = 'software'; this.drawMonitor(this.state.phase === 'done'); } 
        });
        canvas.addEventListener('click', (e) => {
            if(canvas.style.display !== 'block' || this.osState !== 'software') return;
            const rect = canvas.getBoundingClientRect(); const x = (e.clientX - rect.left) * (canvas.width / rect.width); const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            
            if(x > 760 && x < 800 && y > 0 && y < 40) { this.osState = 'desktop'; this.drawMonitor(false); }
            if(this.state.phase === 'done' && x > 250 && x < 550 && y > 480 && y < 530) { window.exportPDFReport('laMonitorCanvas', 'LA_Abrasion_Report'); }
        });

        document.getElementById('laToggleDoorBtn').onclick = () => {
            if(this.state.phase === 'running') return;
            this.state.doorsOpen = !this.state.doorsOpen; 
            const angle = this.state.doorsOpen ? -Math.PI / 1.5 : 0;
            gsap.to(this.doorL.rotation, {y: angle, duration: 1, ease: "power2.inOut"}); 
            gsap.to(this.doorR.rotation, {y: -angle, duration: 1, ease: "power2.inOut"});
        };

        document.getElementById('laLoadAggBtn').onclick = () => { 
            this.state.hasAgg = true; 
            document.getElementById('laLoadAggBtn').disabled = true; 
            if(this.state.hasAgg && this.state.hasSteel) document.getElementById('laRunBtn').disabled = false; 
        };

        document.getElementById('laLoadSteelBtn').onclick = () => { 
            this.state.hasSteel = true; 
            document.getElementById('laLoadSteelBtn').disabled = true; 
            if(this.state.hasAgg && this.state.hasSteel) document.getElementById('laRunBtn').disabled = false; 
            
            this.spheres.forEach(s => { 
                s.mesh.visible = true; 
                s.x = (Math.random() - 0.5) * 0.4; s.y = (Math.random() - 0.5) * 0.4; s.z = (Math.random() - 0.5) * 0.4; 
                s.mesh.position.set(s.x, s.y, s.z); 
            });
        };

        document.getElementById('laSpeedBtn').onclick = () => { 
            this.state.fastMode = true; 
            document.getElementById('laSpeedBtn').disabled = true; 
        };

        document.getElementById('laRunBtn').onclick = () => { 
            if(this.state.doorsOpen) document.getElementById('laToggleDoorBtn').click(); 
            this.state.phase = 'running'; 
            document.getElementById('laRunBtn').disabled = true; 
            document.getElementById('laSpeedBtn').disabled = false; 
            this.playClankSound();
        };

        document.getElementById('laSieveBtn').onclick = () => { 
            document.getElementById('laSieveBtn').disabled = true; 
            this.drawMonitor(true); 
        };

        document.getElementById('laResetBtn').onclick = () => {
            this.state.phase = 'idle'; this.state.revs = 0; this.state.hasAgg = false; this.state.hasSteel = false; this.state.fastMode = false;
            this.drum.rotation.x = 0;
            this.stopClankSound();
            document.getElementById('laLoadAggBtn').disabled = false; document.getElementById('laLoadSteelBtn').disabled = false; 
            document.getElementById('laRunBtn').disabled = true; document.getElementById('laSieveBtn').disabled = true; document.getElementById('laSpeedBtn').disabled = true;
            this.spheres.forEach(s => s.mesh.visible = false); 
            this.drawMonitor(true);
        };
    }

    update(delta) {
        if (this.state.phase === 'running') {
            // ASTM C131: 30 to 33 RPM
            const speed = this.state.fastMode ? 100.0 : 3.5; 
            this.drum.rotation.x -= speed * delta;
            this.state.revs += (speed * delta) / (Math.PI * 2);
            
            this.spheres.forEach(s => {
                s.vy -= 9.8 * delta;
                
                const drumWallSpeed = speed * 0.45;
                s.x += (s.vx + drumWallSpeed * Math.cos(this.drum.rotation.x)) * delta;
                s.y += (s.vy + drumWallSpeed * Math.sin(this.drum.rotation.x)) * delta;
                s.z += s.vz * delta;

                const dist = Math.sqrt(s.x*s.x + s.y*s.y);
                if (dist > 0.4) { 
                    s.x = (s.x / dist) * 0.4; 
                    s.y = (s.y / dist) * 0.4; 
                    s.vy = (Math.random() * 4) + 2; 
                    s.vx = (Math.random() - 0.5) * 4; 
                    s.vz = (Math.random() - 0.5) * 1.5;
                }
                
                if (s.z > 0.35) { s.z = 0.35; s.vz *= -0.5; }
                if (s.z < -0.35) { s.z = -0.35; s.vz *= -0.5; }

                s.mesh.position.set(s.x, s.y, s.z);
            });
            
            if (this.state.revs >= this.state.targetRevs) { 
                this.state.phase = 'done'; 
                this.stopClankSound();
                document.getElementById('laSieveBtn').disabled = false; 
                document.getElementById('laSpeedBtn').disabled = true;
                
                this.spheres.forEach(s => {
                    s.mesh.position.set((Math.random()-0.5)*0.2, -0.4, (Math.random()-0.5)*0.6);
                });
            }
        }
    }
}