class CBRStation {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); this.group.position.set(x, 0, z);
        this.uiID = 'cbrUI'; this.uiVisible = false; this.name = 'CBR Soil Test';
        
        this.state = { phase: 'idle', penetration: 0, load: 0, dataPoints: [] };
        this.osState = 'desktop';
        
        // Standard Loads for 100% CBR (California Limestone)
        this.standardLoad25 = 13.3; // kN at 2.54 mm
        this.standardLoad50 = 20.0; // kN at 5.08 mm
        
        this.buildMachine(); scene.add(this.group); this.bindUI();
        setInterval(() => { this.drawMonitor(this.state.phase === 'done'); }, 1000);
    }

    buildMachine() {
        this.group.add(createAntiVibrationMat(1.5, 1.5));

        // PBR Materials
        const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, metalness: 0.5, roughness: 0.5, clearcoat: 0.3 });
        const steelMat = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
        const soilMat = new THREE.MeshPhysicalMaterial({ color: 0x5c4033, roughness: 1.0, metalness: 0.0 });

        // Machine Frame
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.6), frameMat); base.position.y = 0.1; base.castShadow = true; this.group.add(base);
        const colL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0), steelMat); colL.position.set(-0.3, 0.6, 0); colL.castShadow = true; this.group.add(colL);
        const colR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0), steelMat); colR.position.set(0.3, 0.6, 0); colR.castShadow = true; this.group.add(colR);
        const topBeam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.3), frameMat); topBeam.position.y = 1.1; topBeam.castShadow = true; this.group.add(topBeam);

        // Platen & Piston
        this.platen = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 32), steelMat); this.platen.position.y = 0.225; this.group.add(this.platen);
        this.piston = new THREE.Mesh(new THREE.CylinderGeometry(0.0248, 0.0248, 0.3, 32), steelMat); this.piston.position.y = 0.85; this.group.add(this.piston); // 49.6mm dia piston
        const dial = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({color: 0x111})); dial.position.set(0, 1.0, 0.1); this.group.add(dial);

        // Soil Mold (Hidden initially)
        this.moldGroup = new THREE.Group(); this.moldGroup.position.set(0, 0.35, 0); this.moldGroup.visible = false; this.group.add(this.moldGroup);
        const moldShell = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 32, 1, true), steelMat); moldShell.material.side = THREE.DoubleSide; moldShell.castShadow = true; this.moldGroup.add(moldShell);
        const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.17, 32), soilMat); this.moldGroup.add(soil);
        const surcharge = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 16, 32), steelMat); surcharge.position.y = 0.086; surcharge.rotation.x = Math.PI/2; this.moldGroup.add(surcharge);

        // Monitor
        const desk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.6), new THREE.MeshStandardMaterial({color: 0x111})); desk.position.set(1.0, 0.4, 0.5); desk.castShadow = true; this.group.add(desk);
        const canvas = document.getElementById('cbrMonitorCanvas'); this.ctx = canvas.getContext('2d'); this.screenTexture = new THREE.CanvasTexture(canvas);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ map: this.screenTexture })); screen.position.set(1.0, 1.15, 0.5); screen.rotation.y = -Math.PI / 6; screen.userData.isCBRMonitor = true; this.group.add(screen);
    }

    drawMonitor(isDone = false) {
        if (this.osState === 'desktop') {
            const grad = this.ctx.createLinearGradient(0, 0, 800, 600); grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#1e3a8a');
            this.ctx.fillStyle = grad; this.ctx.fillRect(0,0,800,600);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; this.ctx.fillRect(30, 30, 80, 80);
            this.ctx.fillStyle = '#8b5a2b'; this.ctx.beginPath(); this.ctx.arc(70, 70, 20, 0, Math.PI*2); this.ctx.fill();
            this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '12px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('CBR_Test.exe', 70, 130);
            this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; this.ctx.fillRect(0, 560, 800, 40); this.ctx.fillStyle = '#38bdf8'; this.ctx.fillRect(10, 565, 40, 30);
            this.screenTexture.needsUpdate = true; return;
        }

        this.ctx.fillStyle = '#0f172a'; this.ctx.fillRect(0, 0, 800, 600); 
        this.ctx.fillStyle = '#1e3a8a'; this.ctx.fillRect(0, 0, 800, 40);
        this.ctx.fillStyle = '#ffffff'; this.ctx.font = 'bold 18px Arial'; this.ctx.textAlign = 'left'; this.ctx.fillText('CALIFORNIA BEARING RATIO (ASTM D1883)', 10, 26);
        this.ctx.fillStyle = '#dc2626'; this.ctx.fillRect(760, 0, 40, 40); this.ctx.fillStyle = '#fff'; this.ctx.textAlign = 'center'; this.ctx.fillText('X', 780, 26);

        // GRAPH AREA
        const gx = 80, gy = 520, gw = 450, gh = 400;
        this.ctx.strokeStyle = '#475569'; this.ctx.lineWidth = 2; this.ctx.beginPath(); this.ctx.moveTo(gx, gy-gh); this.ctx.lineTo(gx, gy); this.ctx.lineTo(gx+gw, gy); this.ctx.stroke();
        
        this.ctx.fillStyle = '#94a3b8'; this.ctx.font = '12px Arial'; this.ctx.textAlign = 'right';
        for(let i=0; i<=20; i+=4) { const y = gy - (i/20)*gh; this.ctx.fillText(i + ' kN', gx-10, y+4); }
        this.ctx.textAlign = 'center';
        for(let i=0; i<=10; i+=2.5) { const x = gx + (i/10)*gw; this.ctx.fillText(i.toFixed(1), x, gy+20); }
        this.ctx.fillText('Penetration (mm)', gx + gw/2, gy + 40);
        this.ctx.save(); this.ctx.translate(30, gy-200); this.ctx.rotate(-Math.PI/2); this.ctx.fillText('Load (kN)', 0, 0); this.ctx.restore();

        // PLOT DATA
        if (this.state.dataPoints.length > 0) {
            this.ctx.strokeStyle = '#38bdf8'; this.ctx.lineWidth = 3; this.ctx.beginPath();
            this.state.dataPoints.forEach((pt, i) => {
                const px = gx + (pt.pen / 10) * gw; const py = gy - (pt.load / 20) * gh;
                if(i===0) this.ctx.moveTo(px, py); else this.ctx.lineTo(px, py);
            });
            this.ctx.stroke();
            const last = this.state.dataPoints[this.state.dataPoints.length-1];
            this.ctx.fillStyle = '#fff'; this.ctx.beginPath(); this.ctx.arc(gx + (last.pen/10)*gw, gy - (last.load/20)*gh, 5, 0, Math.PI*2); this.ctx.fill();
        }

        // METRICS PANEL
        this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(550, 60, 230, 460);
        this.ctx.fillStyle = '#2563eb'; this.ctx.fillRect(550, 60, 230, 40);
        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px Arial'; this.ctx.fillText('LIVE DATA', 665, 86);

        this.ctx.fillStyle = '#38bdf8'; this.ctx.textAlign = 'left';
        this.ctx.fillText('Penetration:', 560, 130); this.ctx.fillStyle = '#fff'; this.ctx.font = '20px monospace'; this.ctx.fillText(`${this.state.penetration.toFixed(2)} mm`, 560, 155);
        this.ctx.fillStyle = '#38bdf8'; this.ctx.font = '16px Arial';
        this.ctx.fillText('Current Load:', 560, 190); this.ctx.fillStyle = '#fff'; this.ctx.font = '20px monospace'; this.ctx.fillText(`${this.state.load.toFixed(2)} kN`, 560, 215);

        if (isDone) {
            const getLoadAt = (mm) => { const pt = this.state.dataPoints.find(p => p.pen >= mm); return pt ? pt.load : 0; };
            const load25 = getLoadAt(2.54); const load50 = getLoadAt(5.08);
            const cbr25 = (load25 / this.standardLoad25) * 100;
            const cbr50 = (load50 / this.standardLoad50) * 100;
            const finalCBR = Math.max(cbr25, cbr50);

            this.ctx.fillStyle = '#22c55e'; this.ctx.fillRect(550, 250, 230, 30);
            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 14px Arial'; this.ctx.textAlign='center'; this.ctx.fillText('TEST COMPLETE', 665, 270);
            
            this.ctx.textAlign = 'left'; this.ctx.fillStyle = '#cbd5e1'; this.ctx.font = '14px monospace';
            this.ctx.fillText(`Load @ 2.54: ${load25.toFixed(2)} kN`, 560, 310);
            this.ctx.fillText(`Load @ 5.08: ${load50.toFixed(2)} kN`, 560, 340);
            
            this.ctx.fillStyle = '#eab308'; this.ctx.font = 'bold 16px Arial';
            this.ctx.fillText(`CBR @ 2.54mm: ${cbr25.toFixed(1)}%`, 560, 380);
            this.ctx.fillText(`CBR @ 5.08mm: ${cbr50.toFixed(1)}%`, 560, 410);

            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 22px Arial';
            this.ctx.fillText(`FINAL CBR: ${finalCBR.toFixed(1)}%`, 560, 460);
            
            this.ctx.fillStyle = '#10b981'; this.ctx.fillRect(550, 480, 230, 40);
            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 14px Arial'; this.ctx.textAlign='center'; this.ctx.fillText('💾 EXPORT PDF', 665, 505);
        }

        this.screenTexture.needsUpdate = true;
    }

    bindUI() {
        const canvas = document.getElementById('cbrMonitorCanvas');
        canvas.addEventListener('dblclick', (e) => { if(canvas.style.display === 'block' && this.osState === 'desktop') { this.osState = 'software'; this.drawMonitor(this.state.phase === 'done'); } });
        canvas.addEventListener('click', (e) => {
            if(canvas.style.display !== 'block' || this.osState !== 'software') return;
            const rect = canvas.getBoundingClientRect(); const x = (e.clientX - rect.left) * (canvas.width / rect.width); const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            if(x > 760 && x < 800 && y > 0 && y < 40) { this.osState = 'desktop'; this.drawMonitor(false); }
            if(this.state.phase === 'done' && x > 550 && x < 780 && y > 480 && y < 520) { window.exportPDFReport('cbrMonitorCanvas', 'CBR_Test_Report'); }
        });

        document.getElementById('cbrLoadBtn').onclick = () => { this.moldGroup.visible = true; document.getElementById('cbrLoadBtn').disabled = true; document.getElementById('cbrRunBtn').disabled = false; };
        document.getElementById('cbrRunBtn').onclick = () => { this.state.phase = 'running'; document.getElementById('cbrRunBtn').disabled = true; };
        document.getElementById('cbrResetBtn').onclick = () => { 
            this.state.phase = 'idle'; this.state.penetration = 0; this.state.load = 0; this.state.dataPoints = [];
            this.piston.position.y = 0.85; this.platen.position.y = 0.225; this.moldGroup.position.y = 0.35; this.moldGroup.visible = false;
            document.getElementById('cbrLoadBtn').disabled = false; document.getElementById('cbrRunBtn').disabled = true;
            this.drawMonitor(false);
        };
    }

    update(delta) {
        if (this.state.phase === 'running') {
            this.platen.position.y += 0.05 * delta; // Platen moves up
            this.moldGroup.position.y += 0.05 * delta;
            
            // Piston engages at y = 0.7
            if (this.moldGroup.position.y > 0.6) {
                this.state.penetration += 1.27 * delta; // 1.27 mm/min standard rate (accelerated for sim)
                
                // Simulated typical soil curve (Polynomial)
                const p = this.state.penetration;
                this.state.load = (1.5 * p) - (0.05 * p * p) + (Math.random()*0.1); 
                
                this.state.dataPoints.push({ pen: this.state.penetration, load: this.state.load });
            }

            if(this.osState === 'software') this.drawMonitor(false);

            if (this.state.penetration >= 10.0) { // Stop at 10mm penetration
                this.state.phase = 'done';
                if(this.osState === 'software') this.drawMonitor(true);
            }
        }
    }
}