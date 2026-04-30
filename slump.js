class SlumpStation {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); this.group.position.set(x, 0, z);
        this.uiID = 'slumpUI'; this.uiVisible = false; this.name = 'Slump Test';
        
        this.testState = { phase: 'idle', mixType: 'standard', slumpMm: 75, currentLayer: 0, compactions: 0, animTimer: 0 };
        this.osState = 'desktop'; 
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        this.buildMachine(); scene.add(this.group); this.bindUI(); this.resetMachine();
        setInterval(() => { this.drawMonitor(this.testState.phase === 'done'); }, 1000);
    }

    playTampSound() {
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(80, this.audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(30, this.audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.8, this.audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        osc.connect(gain); gain.connect(this.audioCtx.destination); osc.start(); osc.stop(this.audioCtx.currentTime + 0.2);
    }
    
    playScrapeSound() {
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 1.0);
        osc.connect(gain); gain.connect(this.audioCtx.destination); osc.start(); osc.stop(this.audioCtx.currentTime + 1.2);
    }

    buildMachine() {
        this.group.add(createAntiVibrationMat(2.0, 2.0));

        const galvSteelMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xcbd5e1, metalness: 0.9, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.2, side: THREE.DoubleSide 
        });
        const darkSteelMat = new THREE.MeshPhysicalMaterial({ 
            color: 0x475569, metalness: 0.8, roughness: 0.5, clearcoat: 0.2 
        });
        this.wetConcreteMat = new THREE.MeshPhysicalMaterial({ 
            map: createNoiseTexture('#64748b'), roughness: 0.2, metalness: 0.1, clearcoat: 0.8 
        });

        const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.8), darkSteelMat); basePlate.position.set(0, 0.01, 0); basePlate.receiveShadow = true; this.group.add(basePlate);
        
        this.coneGroup = new THREE.Group(); this.coneGroup.position.set(0, 0.02, 0); this.group.add(this.coneGroup);
        // ASTM C143 Slump Cone: Top Dia: 100mm, Bot Dia: 200mm, Height: 300mm
        const coneMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.3, 32, 1, true), galvSteelMat); coneMesh.position.y = 0.15; coneMesh.castShadow = true; this.coneGroup.add(coneMesh);
        
        const handleGeom = new THREE.TorusGeometry(0.04, 0.006, 16, 32, Math.PI);
        const handle1 = new THREE.Mesh(handleGeom, darkSteelMat); handle1.position.set(0.065, 0.2, 0); handle1.rotation.z = Math.PI / 2; this.coneGroup.add(handle1);
        const handle2 = new THREE.Mesh(handleGeom, darkSteelMat); handle2.position.set(-0.065, 0.2, 0); handle2.rotation.z = -Math.PI / 2; this.coneGroup.add(handle2);
        
        const foot1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.03), darkSteelMat); foot1.position.set(0.12, 0.005, 0); this.coneGroup.add(foot1);
        const foot2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.03), darkSteelMat); foot2.position.set(-0.12, 0.005, 0); this.coneGroup.add(foot2);
        
        // ASTM C143 Tamping Rod: 16mm Dia x 600mm L
        this.rodGroup = new THREE.Group(); this.rodGroup.position.set(0.3, 0.3, 0); this.rodGroup.rotation.z = Math.PI / 6; this.group.add(this.rodGroup);
        const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 16), darkSteelMat); rodMesh.castShadow = true; this.rodGroup.add(rodMesh);
        const rodTip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 16), darkSteelMat); rodTip.position.y = -0.3; this.rodGroup.add(rodTip);
        
        this.concreteGroup = new THREE.Group(); this.concreteGroup.position.set(0, 0.02, 0); this.group.add(this.concreteGroup);
        this.concreteLayers = []; const layerHeights = [0.1, 0.1, 0.1]; const radii = [0.1, 0.083, 0.066, 0.05]; 
        for(let i=0; i<3; i++) { 
            const layer = new THREE.Mesh(new THREE.CylinderGeometry(radii[i+1], radii[i], layerHeights[i], 32), new THREE.MeshBasicMaterial({visible: false})); 
            layer.position.y = (layerHeights[i]/2) + (i * 0.1); this.concreteGroup.add(layer); this.concreteLayers.push(layer); 
        }
        
        this.slumpedConcreteGroup = new THREE.Group(); this.slumpedConcreteGroup.position.set(0, 0.02, 0); this.group.add(this.slumpedConcreteGroup); this.slumpedMesh = null;
        
        this.rulerGroup = new THREE.Group(); this.rulerGroup.visible = false; this.group.add(this.rulerGroup);
        const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.005), new THREE.MeshStandardMaterial({color: 0xdddddd})); ruler.position.set(0, 0.2, 0); this.rulerGroup.add(ruler);
        for(let i=0; i<=30; i++) { const isMajor = i % 5 === 0; const tick = new THREE.Mesh(new THREE.BoxGeometry(isMajor ? 0.022 : 0.015, 0.002, 0.006), new THREE.MeshBasicMaterial({color: 0x000000})); tick.position.set(0, i * 0.01, 0); this.rulerGroup.add(tick); }
        
        const desk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.6), new THREE.MeshStandardMaterial({color: 0x111})); desk.position.set(1.5, 0.4, 0.5); desk.castShadow = true; this.group.add(desk);
        const canvas = document.getElementById('slumpMonitorCanvas'); this.ctx = canvas.getContext('2d'); this.screenTex = new THREE.CanvasTexture(canvas);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshBasicMaterial({map: this.screenTex})); screen.position.set(1.5, 1.15, 0.5); screen.rotation.y = -Math.PI / 6; screen.userData.isSlumpMonitor = true; this.group.add(screen);
    }

    generateSlumpMesh(slumpMeters) {
        if(this.slumpedMesh) this.slumpedConcreteGroup.remove(this.slumpedMesh);
        const finalHeight = Math.max(0.02, 0.3 - slumpMeters);
        const spreadFactor = Math.sqrt(0.3 / finalHeight);
        const geom = new THREE.CylinderGeometry(0.05 * spreadFactor * 0.8, 0.1 * spreadFactor, finalHeight, 32, 8);
        const pos = geom.attributes.position;
        for(let i=0; i<pos.count; i++) {
            const y = pos.getY(i);
            if (y > (finalHeight/2) - 0.02) { pos.setY(i, y - ((Math.sqrt(Math.pow(pos.getX(i),2) + Math.pow(pos.getZ(i),2)) / (0.05 * spreadFactor * 0.8)) * 0.03) + (Math.random()*0.005)); }
        }
        geom.computeVertexNormals(); this.slumpedMesh = new THREE.Mesh(geom, this.wetConcreteMat); this.slumpedMesh.position.y = finalHeight / 2; this.slumpedMesh.castShadow = true; this.slumpedConcreteGroup.add(this.slumpedMesh);
    }

    resetMachine() {
        this.testState.phase = 'idle'; this.testState.currentLayer = 0; this.testState.compactions = 0; this.testState.animTimer = 0;
        this.coneGroup.position.set(0, 0.02, 0); this.coneGroup.rotation.x = 0;
        this.rodGroup.position.set(0.3, 0.3, 0); this.rodGroup.rotation.z = Math.PI / 6;
        
        if(this.slumpedMesh) { this.slumpedConcreteGroup.remove(this.slumpedMesh); this.slumpedMesh = null; }
        this.rulerGroup.visible = false; 
        this.concreteLayers.forEach(l => { l.material = new THREE.MeshBasicMaterial({visible: false}); });
        
        document.getElementById('fillBtn').disabled = false; document.getElementById('fillBtn').textContent = 'Fill Layer 1 [1]';
        document.getElementById('compactBtn').disabled = true; document.getElementById('compactBtn').textContent = 'Rod Layer [2]';
        document.getElementById('liftBtn').disabled = true; document.getElementById('measureBtn').disabled = true;
        
        if (this.testState.mixType.startsWith('inv_')) {
            const batchId = this.testState.mixType.split('_')[1]; 
            const mix = window.LabState.inventory.find(m => m.batchId == batchId); 
            this.testState.slumpMm = mix ? mix.slumpMm : 75;
        } else { this.testState.slumpMm = 75; }
        this.drawMonitor(this.testState.phase === 'done');
    }

    drawMonitor(isDone = false) {
        const grad = this.ctx.createLinearGradient(0, 0, 800, 600);
        grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#1e3a8a');
        this.ctx.fillStyle = grad; this.ctx.fillRect(0,0,800,600);

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'; this.ctx.lineWidth = 1;
        for(let i=0; i<800; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(i,0); this.ctx.lineTo(i,600); this.ctx.stroke(); }
        for(let i=0; i<600; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(0,i); this.ctx.lineTo(800,i); this.ctx.stroke(); }

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; this.ctx.fillRect(30, 30, 80, 80);
        this.ctx.fillStyle = '#cbd5e1'; this.ctx.beginPath(); this.ctx.moveTo(70, 45); this.ctx.lineTo(85, 90); this.ctx.lineTo(55, 90); this.ctx.fill();
        this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '12px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('SlumpOS.exe', 70, 130);

        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; this.ctx.fillRect(0, 560, 800, 40);
        this.ctx.fillStyle = '#38bdf8'; this.ctx.fillRect(10, 565, 40, 30); 
        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('ACI', 30, 586);
        
        const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '14px Arial'; this.ctx.textAlign = 'right'; this.ctx.fillText(timeString, 780, 585);

        if (this.osState === 'software') {
            const wx = 50, wy = 40, ww = 700, wh = 500;
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)'; this.ctx.fillRect(wx+5, wy+5, ww, wh);
            this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(wx, wy, ww, wh);
            this.ctx.fillStyle = '#334155'; this.ctx.fillRect(wx, wy, ww, 30);
            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 14px Arial'; this.ctx.textAlign = 'left'; this.ctx.fillText('Slump Analysis Suite v2.0', wx + 10, wy + 20);
            this.ctx.fillStyle = '#ef4444'; this.ctx.fillRect(wx + ww - 40, wy, 40, 30);
            this.ctx.fillStyle = '#fff'; this.ctx.textAlign = 'center'; this.ctx.fillText('X', wx + ww - 20, wy + 20);

            this.ctx.fillStyle = '#0f172a'; this.ctx.fillRect(wx+10, wy+40, ww-20, wh-50);
            
            let typeStr = this.testState.mixType.startsWith('inv') ? "CUSTOM BATCH" : "GENERIC MIX";
            this.ctx.fillStyle = '#38bdf8'; this.ctx.font = 'bold 20px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText(`CURRENT SPECIMEN: ${typeStr}`, wx + ww/2, wy + 80);

            if (!isDone) { 
                this.ctx.fillStyle = '#f59e0b'; this.ctx.font = '18px monospace'; this.ctx.textAlign='center'; 
                let statusText = `AWAITING DATA... (Layer ${this.testState.currentLayer}/3)`;
                this.ctx.fillText(statusText, wx + ww/2, wy + 250); 
            } else {
                const cx = wx + 200, cy = wy + 400; 
                this.ctx.strokeStyle = '#94a3b8'; this.ctx.lineWidth = 2; this.ctx.setLineDash([5, 5]);
                this.ctx.beginPath(); this.ctx.moveTo(cx - 40, cy - 250); this.ctx.lineTo(cx + 40, cy - 250); this.ctx.lineTo(cx + 80, cy); this.ctx.lineTo(cx - 80, cy); this.ctx.closePath(); this.ctx.stroke(); this.ctx.setLineDash([]);

                const finalH = Math.max(20, 250 - (this.testState.slumpMm * 0.83)); const spread = Math.sqrt(250 / finalH);
                this.ctx.fillStyle = '#475569'; this.ctx.beginPath(); this.ctx.moveTo(cx - (40*spread), cy - finalH); this.ctx.lineTo(cx + (40*spread), cy - finalH); this.ctx.lineTo(cx + (80*spread), cy); this.ctx.lineTo(cx - (80*spread), cy); this.ctx.closePath(); this.ctx.fill();

                this.ctx.strokeStyle = '#ef4444'; this.ctx.lineWidth = 2; 
                this.ctx.beginPath(); this.ctx.moveTo(cx + 120, cy - 250); this.ctx.lineTo(cx + 160, cy - 250); this.ctx.stroke();
                this.ctx.beginPath(); this.ctx.moveTo(cx + 120, cy - finalH); this.ctx.lineTo(cx + 160, cy - finalH); this.ctx.stroke();
                this.ctx.beginPath(); this.ctx.moveTo(cx + 140, cy - 250); this.ctx.lineTo(cx + 140, cy - finalH); this.ctx.stroke();
                this.ctx.fillStyle = '#ef4444'; this.ctx.font = 'bold 18px Arial'; this.ctx.fillText(`${this.testState.slumpMm.toFixed(0)} mm`, cx + 200, cy - 250 + ((250-finalH)/2));

                this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(wx + 450, wy + 120, 200, 260); 
                this.ctx.fillStyle = '#38bdf8'; this.ctx.textAlign = 'left'; this.ctx.fillText('RESULTS', wx + 465, wy + 150);
                this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '16px monospace'; this.ctx.fillText(`Final: ${(300 - this.testState.slumpMm).toFixed(0)} mm`, wx + 465, wy + 190); 
                this.ctx.fillStyle = '#4ade80'; this.ctx.fillText(`Slump: ${this.testState.slumpMm.toFixed(0)} mm`, wx + 465, wy + 230);

                let workability = '';
                if(this.testState.slumpMm < 50) workability = 'Low (Stiff)'; else if(this.testState.slumpMm <= 100) workability = 'Medium (Normal)'; else if(this.testState.slumpMm <= 150) workability = 'High (Flow)'; else workability = 'Collapse';
                this.ctx.fillStyle = '#e1e7ef'; this.ctx.fillText(`Type: ${workability}`, wx + 465, wy + 290);
                
                this.ctx.fillStyle = '#10b981'; this.ctx.fillRect(wx + 450, wy + 390, 200, 40); this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('💾 EXPORT PDF', wx + 550, wy + 415);
            }
        }
        this.screenTex.needsUpdate = true;
    }

    bindUI() {
        const canvas = document.getElementById('slumpMonitorCanvas');
        canvas.addEventListener('dblclick', (e) => { 
            if(canvas.style.display === 'block' && this.osState === 'desktop') { this.osState = 'software'; this.drawMonitor(this.testState.phase === 'done'); } 
        });
        canvas.addEventListener('click', (e) => {
            if(canvas.style.display !== 'block' || this.osState !== 'software') return;
            const rect = canvas.getBoundingClientRect(); const x = (e.clientX - rect.left) * (canvas.width / rect.width); const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            if(x > 710 && x < 750 && y > 40 && y < 70) { this.osState = 'desktop'; this.drawMonitor(false); }
            if(x > 500 && x < 700 && y > 430 && y < 470 && this.testState.phase === 'done') { window.exportPDFReport('slumpMonitorCanvas', 'Slump_Test_Report'); }
        });
        
        window.addEventListener('inventoryUpdate', () => {
            const select = document.getElementById('slumpType');
            Array.from(select.options).forEach(opt => { if(opt.value.startsWith('inv_')) select.remove(opt.index); });
            
            const batches = new Set();
            window.LabState.inventory.forEach(mix => { 
                if(mix.type !== 'steel' && !batches.has(mix.batchId) && !mix.id.toString().startsWith('std_')) {
                    batches.add(mix.batchId);
                    const opt = document.createElement('option'); 
                    opt.value = `inv_${mix.batchId}`; 
                    opt.text = mix.mixName; 
                    select.add(opt); 
                }
            });
        });
        
        document.getElementById('slumpType').onchange = (e) => { this.testState.mixType = e.target.value; this.resetMachine(); };
        
        document.getElementById('fillBtn').onclick = () => { 
            this.testState.phase = 'filling'; 
            this.testState.animTimer = 0; 
            document.getElementById('fillBtn').disabled = true; 
        };
        
        document.getElementById('compactBtn').onclick = () => { 
            this.testState.phase = 'compacting'; 
            this.testState.animTimer = 0; 
            document.getElementById('compactBtn').disabled = true; 
            this.rodGroup.position.set(0, 0.4 + (this.testState.currentLayer * 0.1), 0); 
            this.rodGroup.rotation.z = 0; 
        };
        
        document.getElementById('liftBtn').onclick = () => { this.testState.phase = 'lifting'; this.testState.animTimer = 0; document.getElementById('liftBtn').disabled = true; this.playScrapeSound(); };
        document.getElementById('measureBtn').onclick = () => { this.testState.phase = 'measuring_prep'; this.testState.animTimer = 0; document.getElementById('measureBtn').disabled = true; };
        document.getElementById('resetSlump').onclick = () => { this.resetMachine(); };
    }

    update(delta) {
        if (this.testState.phase === 'filling') {
            this.testState.animTimer += delta;
            if (this.testState.animTimer > 0.5) {
                this.concreteLayers[this.testState.currentLayer].material = this.wetConcreteMat;
                this.testState.phase = 'waiting_rod';
                document.getElementById('compactBtn').disabled = false;
                document.getElementById('compactBtn').textContent = `Rod Layer ${this.testState.currentLayer + 1} [2]`;
            }
        }
        
        if (this.testState.phase === 'compacting') {
            this.testState.animTimer += delta; 
            const baseHeight = 0.25 + (this.testState.currentLayer * 0.1);
            this.rodGroup.position.y = baseHeight + 0.1 + Math.sin(this.testState.animTimer * 20) * 0.15;
            
            if (this.rodGroup.position.y < baseHeight && !this.dipped) { 
                // ASTM C143 Compaction Rule: 25 strokes per layer
                this.testState.compactions++; this.dipped = true; this.playTampSound(); 
                document.getElementById('compactBtn').textContent = `Rodding (${this.testState.compactions}/25)`; 
            }
            if (this.rodGroup.position.y > baseHeight + 0.15) this.dipped = false;
            
            if (this.testState.compactions >= 25) { 
                this.testState.currentLayer++;
                this.testState.compactions = 0;
                this.rodGroup.position.set(0.3, 0.3, 0); this.rodGroup.rotation.z = Math.PI / 6; 
                
                if (this.testState.currentLayer < 3) {
                    this.testState.phase = 'waiting_fill';
                    document.getElementById('fillBtn').disabled = false;
                    document.getElementById('fillBtn').textContent = `Fill Layer ${this.testState.currentLayer + 1} [1]`;
                    document.getElementById('compactBtn').textContent = 'Rod Layer [2]';
                } else {
                    this.testState.phase = 'compacted';
                    document.getElementById('liftBtn').disabled = false;
                    document.getElementById('compactBtn').textContent = 'Fully Compacted';
                }
            }
        }
        
        if (this.testState.phase === 'lifting') {
            this.testState.animTimer += delta; this.coneGroup.position.y += 0.4 * delta;
            if (this.coneGroup.position.y > 0.4) {
                this.testState.phase = 'lifted'; 
                this.concreteLayers.forEach(l => { l.material = new THREE.MeshBasicMaterial({visible: false}); });
                
                const finalSlump = this.testState.slumpMm + (Math.random() * 10 - 5); this.testState.slumpMm = Math.max(0, finalSlump);
                this.generateSlumpMesh(this.testState.slumpMm / 1000); 
                document.getElementById('measureBtn').disabled = false;
                
                if (this.testState.mixType.startsWith('inv_')) {
                    const batchId = this.testState.mixType.split('_')[1];
                    window.LabState.inventory.forEach(m => {
                        if (m.batchId == batchId) m.testedSlump = Math.round(this.testState.slumpMm);
                    });
                    window.dispatchEvent(new Event('inventoryUpdate'));
                }
            }
        }
        
        if (this.testState.phase === 'measuring_prep') {
            this.testState.animTimer += delta; 
            this.coneGroup.position.set(0.25, 0.32, 0); this.coneGroup.rotation.x = Math.PI; 
            this.rodGroup.position.set(0.1, 0.326, 0); this.rodGroup.rotation.z = Math.PI / 2;
            this.rulerGroup.visible = true; this.rulerGroup.position.y = 0.2 - (this.testState.animTimer * 0.5);
            if (this.rulerGroup.position.y <= 0) { 
                this.rulerGroup.position.y = 0; this.testState.phase = 'done'; 
                if(this.osState === 'software') this.drawMonitor(true); 
            }
        }
    }
}