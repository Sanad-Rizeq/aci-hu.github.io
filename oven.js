class OvenStation {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); this.group.position.set(x, 0, z);
        this.uiID = 'ovenUI'; this.uiVisible = false; this.name = 'Oven & Absorption';
        this.state = { phase: 'idle', doorOpen: false, hasSpecimen: false, temp: 23, initialMass: 0, finalMass: 0, absorption: 0 };
        this.osState = 'desktop'; this.activeMix = null;
        this.buildMachine(); scene.add(this.group); this.bindUI();
        setInterval(() => { if(this.osState === 'desktop') this.drawMonitor(false); if(this.osState === 'software') this.drawMonitor(true); }, 1000);
    }

    buildMachine() {
        this.group.add(createAntiVibrationMat(2.0, 1.5));

        const steelMatGeneral = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });

        const deskMat = new THREE.MeshStandardMaterial({color: 0x1e293b});
        const desk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.6), deskMat); desk.position.set(1.2, 0.4, 0.3); desk.castShadow = true; this.group.add(desk);
        
        const scaleBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), new THREE.MeshStandardMaterial({color: 0x111111})); scaleBase.position.set(1.2, 0.825, 0.3); this.group.add(scaleBase);
        const scalePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 32), steelMatGeneral); scalePlate.position.set(1.2, 0.86, 0.3); this.group.add(scalePlate);

        const ovenMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.6, roughness: 0.4 });
        const ovenInsideMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, side: THREE.DoubleSide });
        
        const ovenBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.0), ovenMat); ovenBody.position.set(-0.3, 0.7, 0); ovenBody.castShadow = true; this.group.add(ovenBody);
        const ovenCavity = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.8), ovenInsideMat); ovenCavity.position.set(-0.3, 0.7, 0.11); this.group.add(ovenCavity);
        
        const rackGeom = new THREE.BoxGeometry(0.9, 0.02, 0.7);
        const rack1 = new THREE.Mesh(rackGeom, steelMatGeneral); rack1.position.set(-0.3, 0.5, 0.1); this.group.add(rack1);
        const rack2 = new THREE.Mesh(rackGeom, steelMatGeneral); rack2.position.set(-0.3, 0.9, 0.1); this.group.add(rack2);

        this.doorPivot = new THREE.Group(); this.doorPivot.position.set(0.25, 0.7, 0.5); this.group.add(this.doorPivot);
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.05), ovenMat); door.position.set(-0.55, 0, 0); this.doorPivot.add(door);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), steelMatGeneral); handle.position.set(-1.0, 0, 0.05); this.doorPivot.add(handle);

        const loadHitbox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.8), new THREE.MeshBasicMaterial({visible:false}));
        loadHitbox.position.set(-0.3, 0.7, 0.1); loadHitbox.userData.isOvenLoader = true; this.group.add(loadHitbox);

        this.specimenGroup = new THREE.Group(); this.specimenGroup.position.set(-0.3, 0.55, 0.1); this.group.add(this.specimenGroup);

        const canvas = document.getElementById('ovenMonitorCanvas'); this.ctx = canvas.getContext('2d'); this.screenTexture = new THREE.CanvasTexture(canvas);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ map: this.screenTexture })); screen.position.set(1.2, 1.15, 0.3); screen.rotation.y = -Math.PI / 6; screen.userData.isOvenMonitor = true; this.group.add(screen);
    }

    loadSpecimenFromHand(mixData) {
        if(this.state.phase !== 'idle' || !this.state.doorOpen) { alert("Open the oven door first!"); return false; }
        while(this.specimenGroup.children.length > 0){ this.specimenGroup.remove(this.specimenGroup.children[0]); }
        
        this.activeMix = mixData; this.state.hasSpecimen = true;
        
        const volFactor = mixData.type === 'cylinder' ? 5.3 : 3.375; 
        const wetDensity = 2.4; 
        this.state.initialMass = volFactor * wetDensity * 1000; 
        
        const geom = mixData.type === 'cylinder' ? new THREE.CylinderGeometry(0.075, 0.075, 0.3, 32) : new THREE.BoxGeometry(0.15, 0.15, 0.15);
        this.testMesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ map: createNoiseTexture('#94a3b8'), roughness: 0.9 }));
        this.testMesh.position.y = mixData.type === 'cylinder' ? 0.15 : 0.075; this.testMesh.castShadow = true;
        this.specimenGroup.add(this.testMesh);

        document.getElementById('ovenBakeBtn').disabled = false;
        this.drawMonitor(true);
        return true;
    }

    drawMonitor(isReady = false) {
        if (this.osState === 'desktop') {
            this.ctx.fillStyle = '#0c1116'; this.ctx.fillRect(0,0,800,600); this.ctx.strokeStyle = 'rgba(0, 217, 255, 0.1)'; this.ctx.lineWidth = 1;
            for(let i=0; i<800; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(i,0); this.ctx.lineTo(i,600); this.ctx.stroke(); }
            for(let i=0; i<600; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(0,i); this.ctx.lineTo(800,i); this.ctx.stroke(); }
            this.ctx.fillStyle = 'rgba(0, 217, 255, 0.05)'; this.ctx.fillRect(30, 30, 100, 100); this.ctx.strokeStyle = '#00d9ff'; this.ctx.strokeRect(30, 30, 100, 100);
            this.ctx.fillStyle = '#ef4444'; this.ctx.fillRect(50, 50, 60, 60);
            this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '14px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('Thermal OS', 80, 150);
            this.ctx.fillStyle = '#1a2332'; this.ctx.fillRect(0, 560, 800, 40); this.ctx.fillStyle = '#00d9ff'; this.ctx.fillRect(10, 565, 30, 30); this.screenTexture.needsUpdate = true; return;
        }

        this.ctx.fillStyle = '#0f172a'; this.ctx.fillRect(0, 0, 800, 600); this.ctx.fillStyle = '#1e3a8a'; this.ctx.fillRect(0, 0, 800, 60);
        // ASTM C642
        this.ctx.fillStyle = '#ffffff'; this.ctx.font = 'bold 28px Arial'; this.ctx.textAlign = 'left'; this.ctx.fillText('OVEN DRY & ABSORPTION TEST (ASTM C642)', 20, 40);
        this.ctx.fillStyle = '#dc2626'; this.ctx.fillRect(750, 10, 40, 40); this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 20px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('X', 770, 38);

        this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(20, 80, 360, 400);
        this.ctx.fillStyle = '#38bdf8'; this.ctx.font = 'bold 20px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('CHAMBER STATUS', 200, 120);
        
        this.ctx.fillStyle = '#000'; this.ctx.fillRect(100, 150, 200, 80);
        this.ctx.fillStyle = this.state.temp > 50 ? '#ef4444' : '#4ade80'; this.ctx.font = 'bold 48px monospace'; this.ctx.fillText(`${Math.floor(this.state.temp)}°C`, 200, 205);

        this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '16px Arial'; this.ctx.textAlign = 'left';
        this.ctx.fillText(`Door Status: ${this.state.doorOpen ? 'OPEN' : 'CLOSED'}`, 50, 280);
        this.ctx.fillText(`Phase: ${this.state.phase.toUpperCase()}`, 50, 320);

        this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(400, 80, 380, 400);
        this.ctx.fillStyle = '#eab308'; this.ctx.textAlign = 'center'; this.ctx.font = 'bold 20px Arial'; this.ctx.fillText('SAMPLE DATA', 590, 120);

        if(this.activeMix) {
            this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '16px monospace'; this.ctx.textAlign = 'left';
            this.ctx.fillText(`ID: ${this.activeMix.name}`, 430, 180);
            this.ctx.fillText(`Initial Wet Mass: ${this.state.initialMass.toFixed(1)} g`, 430, 230);
            
            if(this.state.phase === 'done' || this.state.phase === 'weighing') {
                this.ctx.fillText(`Final Dry Mass: ${this.state.finalMass.toFixed(1)} g`, 430, 280);
                this.ctx.fillStyle = '#4ade80'; this.ctx.font = 'bold 24px monospace';
                this.ctx.fillText(`Absorption: ${this.state.absorption.toFixed(2)} %`, 430, 340);
                
                this.ctx.fillStyle = '#10b981'; this.ctx.fillRect(250, 510, 300, 50); this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 20px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('💾 EXPORT PDF', 400, 542);
            }
        } else {
            this.ctx.fillStyle = '#94a3b8'; this.ctx.font = '16px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('No Specimen Loaded', 590, 250);
        }

        this.screenTexture.needsUpdate = true;
    }

    bindUI() {
        const canvas = document.getElementById('ovenMonitorCanvas');
        canvas.addEventListener('dblclick', (e) => { if(canvas.style.display === 'block' && this.osState === 'desktop') { this.osState = 'software'; this.drawMonitor(true); } });
        canvas.addEventListener('click', (e) => {
            if(canvas.style.display !== 'block' || this.osState !== 'software') return;
            const rect = canvas.getBoundingClientRect(); const x = (e.clientX - rect.left) * (canvas.width / rect.width); const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            if(x > 750 && x < 790 && y > 10 && y < 50) { this.osState = 'desktop'; this.drawMonitor(false); }
            if((this.state.phase === 'done' || this.state.phase === 'weighing') && x > 250 && x < 550 && y > 510 && y < 560) { window.exportPDFReport('ovenMonitorCanvas', 'Absorption_Test_Report'); }
        });

        document.getElementById('ovenDoorBtn').onclick = () => {
            if(this.state.phase === 'baking') return; 
            this.state.doorOpen = !this.state.doorOpen;
            gsap.to(this.doorPivot.rotation, {y: this.state.doorOpen ? Math.PI / 1.5 : 0, duration: 1});
            this.drawMonitor(true);
        };

        document.getElementById('ovenBakeBtn').onclick = () => {
            if(this.state.doorOpen) { document.getElementById('ovenDoorBtn').click(); } 
            this.state.phase = 'baking'; document.getElementById('ovenBakeBtn').disabled = true;
            
            let wc = parseFloat(this.activeMix.w) / parseFloat(this.activeMix.c) || 0.5;
            let waterLossPct = (wc * 0.15) + (Math.random() * 0.02); 
            this.state.finalMass = this.state.initialMass * (1 - waterLossPct);
            this.state.absorption = ((this.state.initialMass - this.state.finalMass) / this.state.finalMass) * 100;

            // ASTM C642 Baking Temp: 110°C
            gsap.to(this.state, { temp: 110, duration: 3, ease: "power1.inOut", onUpdate: () => this.drawMonitor(true), onComplete: () => {
                setTimeout(() => {
                    gsap.to(this.state, { temp: 23, duration: 3, ease: "power1.inOut", onUpdate: () => this.drawMonitor(true), onComplete: () => {
                        this.state.phase = 'done'; this.drawMonitor(true); alert("Baking complete. Specimen is dry.");
                    }});
                }, 2000); 
            }});
        };

        document.getElementById('ovenWeighBtn').onclick = () => {
            if(this.state.phase === 'done') {
                this.state.phase = 'weighing';
                gsap.to(this.specimenGroup.position, {x: 1.2, y: 0.9, z: 0.3, duration: 1, ease: "power2.out"}); 
                this.drawMonitor(true);
            } else if (this.state.phase === 'idle' && this.state.hasSpecimen) {
                gsap.to(this.specimenGroup.position, {x: 1.2, y: 0.9, z: 0.3, duration: 1, ease: "power2.out"}); 
            }
        };

        document.getElementById('ovenResetBtn').onclick = () => {
            this.state.phase = 'idle'; this.state.hasSpecimen = false; this.activeMix = null;
            this.state.initialMass = 0; this.state.finalMass = 0; this.state.absorption = 0;
            while(this.specimenGroup.children.length > 0){ this.specimenGroup.remove(this.specimenGroup.children[0]); }
            this.specimenGroup.position.set(-0.3, 0.55, 0.1); 
            document.getElementById('ovenBakeBtn').disabled = true; this.drawMonitor(true);
        };
    }

    update(delta) { }
}