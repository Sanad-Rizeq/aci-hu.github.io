class SieveStation {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); this.group.position.set(x, 0, z);
        this.uiID = 'sieveUI'; this.uiVisible = false; this.name = 'Sieve Analysis';
        this.state = { phase: 'idle', time: 0, isInspecting: false };
        this.osState = 'desktop'; 
        this.buildMachine(); 
        scene.add(this.group); 
        this.bindUI();
        
        setInterval(() => { this.drawMonitor(this.state.phase === 'done'); }, 1000);
    }

    buildMachine() {
        this.group.add(createAntiVibrationMat(1.5, 1.5));

        const matBrass = new THREE.MeshPhysicalMaterial({ 
            color: 0xcd9575, metalness: 0.9, roughness: 0.3, clearcoat: 0.5, side: THREE.DoubleSide 
        }); 
        const matRubber = new THREE.MeshPhysicalMaterial({ 
            color: 0x111111, metalness: 0.1, roughness: 0.9, clearcoat: 0.1 
        }); 
        const matWhite = new THREE.MeshPhysicalMaterial({ 
            color: 0xf8fafc, roughness: 0.5, metalness: 0.2, clearcoat: 0.2 
        }); 
        const matStone = new THREE.MeshPhysicalMaterial({ 
            color: 0x888888, roughness: 0.9, metalness: 0.1 
        }); 

        const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), matWhite); base.position.y = 0.15; base.castShadow = true; base.receiveShadow = true; this.group.add(base);
        const screenPanel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.05), matRubber); screenPanel.position.set(0, 0.2, 0.45); this.group.add(screenPanel);

        // Extended rods to fit the taller 9-sieve stack
        const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
        const rod1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5), steelMat); rod1.position.set(-0.35, 1.0, 0); this.group.add(rod1);
        const rod2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5), steelMat); rod2.position.set(0.35, 1.0, 0); this.group.add(rod2);

        this.vibratingGroup = new THREE.Group(); this.vibratingGroup.position.y = 0.35; this.group.add(this.vibratingGroup);
        const motorPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 32), matRubber); motorPlate.castShadow = true; this.vibratingGroup.add(motorPlate);

        // Full ASTM Standard Stack
        this.sieves = [ 
            { size: '3/8" (9.5mm)', opening: 9.5, meshDensity: 4 },
            { size: '#4 (4.75mm)', opening: 4.75, meshDensity: 8 },
            { size: '#8 (2.36mm)', opening: 2.36, meshDensity: 16 },
            { size: '#16 (1.18mm)', opening: 1.18, meshDensity: 32 },
            { size: '#30 (0.6mm)', opening: 0.60, meshDensity: 64 },
            { size: '#50 (0.3mm)', opening: 0.30, meshDensity: 128 },
            { size: '#100 (0.15mm)', opening: 0.15, meshDensity: 256 },
            { size: '#200 (0.075mm)', opening: 0.075, meshDensity: 512 },
            { size: 'Pan', opening: 0.0, meshDensity: 0 } 
        ];
        
        const sieveHeight = 0.12; const sieveRadius = 0.3; this.sieveObjects = [];

        this.sieves.forEach((sieve, index) => {
            const sieveGroup = new THREE.Group();
            sieveGroup.userData = { origY: 0.05 + (sieveHeight / 2) + ((this.sieves.length - 1 - index) * sieveHeight), currentOffsetX: 0, currentOffsetY: 0, currentOffsetZ: 0, targetOffsetX: 0, targetOffsetY: 0, targetOffsetZ: 0 };
            sieveGroup.position.y = sieveGroup.userData.origY;
            
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(sieveRadius, sieveRadius, sieveHeight, 64, 1, true), matBrass); rim.castShadow = true; sieveGroup.add(rim);
            const label = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshBasicMaterial({ map: createSieveLabel(sieve.size.split(' ')[0]) })); label.position.set(0, 0, sieveRadius + 0.001); sieveGroup.add(label);

            if (sieve.opening > 0) { 
                const screen = new THREE.Mesh(new THREE.CircleGeometry(sieveRadius - 0.005, 32), new THREE.MeshStandardMaterial({ map: createMeshTexture(sieve.meshDensity), transparent: true, side: THREE.DoubleSide, metalness: 0.8 })); 
                screen.rotation.x = -Math.PI / 2; screen.position.y = -sieveHeight / 2 + 0.01; sieveGroup.add(screen); 
            } else { 
                const panBottom = new THREE.Mesh(new THREE.CircleGeometry(sieveRadius, 32), matBrass); 
                panBottom.rotation.x = -Math.PI / 2; panBottom.position.y = -sieveHeight / 2; sieveGroup.add(panBottom); 
            }
            this.vibratingGroup.add(sieveGroup); this.sieveObjects.push({ group: sieveGroup, data: sieve, yFloor: sieveGroup.position.y - (sieveHeight/2) + 0.01 });
        });

        // Raised top plate to sit on top of the 9th sieve
        const topPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 32), matRubber); topPlate.position.y = 0.05 + (sieveHeight * this.sieves.length) + 0.05; this.vibratingGroup.add(topPlate);

        // Particle System
        this.particleCount = 1500; 
        this.particleMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), matStone, this.particleCount); 
        this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.particleMesh.castShadow = true; this.vibratingGroup.add(this.particleMesh);
        this.dummy = new THREE.Object3D(); this.particles = []; const topY = this.sieveObjects[0].yFloor + 0.5; 

        for (let i = 0; i < this.particleCount; i++) {
            const rand = Math.random(); 
            let radiusMm = rand > 0.8 ? 5 + Math.random() * 4 : (rand > 0.4 ? 1.0 + Math.random() * 3.5 : 0.05 + Math.random() * 0.8);             
            let targetSieveIndex = this.sieves.length - 1; 
            for (let s = 0; s < this.sieves.length - 1; s++) { if (radiusMm > this.sieves[s].opening) { targetSieveIndex = s; break; } }
            const angle = Math.random() * Math.PI * 2; const r = Math.random() * (sieveRadius - 0.05);
            this.particles.push({ 
                x: Math.cos(angle) * r, z: Math.sin(angle) * r, 
                currentY: topY + Math.random() * 0.5, targetSieve: targetSieveIndex, currentSieve: 0, 
                radius: radiusMm / 200, isSettled: false, fallSpeed: 0, stackOffset: Math.random() * (radiusMm / 200) * 1.5 
            });
            this.updateParticle(i);
        }
        this.particleMesh.instanceMatrix.needsUpdate = true;

        const desk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.6), new THREE.MeshStandardMaterial({color: 0x111})); desk.position.set(1.5, 0.4, 0.5); desk.castShadow = true; this.group.add(desk);
        const canvas = document.getElementById('sieveMonitorCanvas'); this.ctx = canvas.getContext('2d'); this.screenTexture = new THREE.CanvasTexture(canvas);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ map: this.screenTexture })); screen.position.set(1.5, 1.15, 0.5); screen.rotation.y = -Math.PI / 6; screen.userData.isSieveMonitor = true; this.group.add(screen);
    }

    updateParticle(index) {
        const p = this.particles[index]; const sOffset = this.sieveObjects[p.currentSieve].group.userData;
        const displayY = p.currentY + sOffset.currentOffsetY + (this.state.phase === 'shaking' && !p.isSettled ? Math.random()*0.005 : 0);
        this.dummy.position.set(p.x + sOffset.currentOffsetX, displayY, p.z + sOffset.currentOffsetZ);
        this.dummy.scale.set(p.radius, p.radius, p.radius); this.dummy.updateMatrix(); this.particleMesh.setMatrixAt(index, this.dummy.matrix);
    }

    drawMonitor(isReady = false) {
        const grad = this.ctx.createLinearGradient(0, 0, 800, 600);
        grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#1e3a8a');
        this.ctx.fillStyle = grad; this.ctx.fillRect(0,0,800,600);
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'; this.ctx.lineWidth = 1;
        for(let i=0; i<800; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(i,0); this.ctx.lineTo(i,600); this.ctx.stroke(); }
        for(let i=0; i<600; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(0,i); this.ctx.lineTo(800,i); this.ctx.stroke(); }

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; this.ctx.fillRect(30, 30, 80, 80);
        this.ctx.fillStyle = '#10b981'; this.ctx.fillRect(50, 45, 40, 50); 
        this.ctx.fillStyle = '#fff'; this.ctx.fillRect(60, 55, 5, 30); this.ctx.fillRect(70, 65, 5, 20); this.ctx.fillRect(80, 50, 5, 35);
        this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '12px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('PSD_Graph.exe', 70, 130);

        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; this.ctx.fillRect(0, 560, 800, 40);
        this.ctx.fillStyle = '#38bdf8'; this.ctx.fillRect(10, 565, 40, 30);
        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('ACI', 30, 586);
        const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '14px Arial'; this.ctx.textAlign = 'right'; this.ctx.fillText(timeString, 780, 585);

        if (this.osState === 'software') {
            const wx = 30, wy = 30, ww = 740, wh = 510;
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)'; this.ctx.fillRect(wx+5, wy+5, ww, wh);
            this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(wx, wy, ww, wh);
            this.ctx.fillStyle = '#334155'; this.ctx.fillRect(wx, wy, ww, 30);
            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 14px Arial'; this.ctx.textAlign = 'left'; this.ctx.fillText('Aggregate Analysis - PSD Plotter v4.2', wx + 10, wy + 20);
            this.ctx.fillStyle = '#ef4444'; this.ctx.fillRect(wx + ww - 40, wy, 40, 30);
            this.ctx.fillStyle = '#fff'; this.ctx.textAlign = 'center'; this.ctx.fillText('X', wx + ww - 20, wy + 20);

            this.ctx.fillStyle = '#0f172a'; this.ctx.fillRect(wx+10, wy+40, ww-20, wh-50);

            if (!isReady) { 
                this.ctx.fillStyle = '#f59e0b'; this.ctx.font = '24px monospace'; this.ctx.textAlign='center'; 
                this.ctx.fillText('AWAITING SIEVE SHAKER COMPLETION...', wx + ww/2, wy + 250); 
            } else {
                let totalMass = 0; const massRetained = new Array(this.sieves.length).fill(0);
                this.particles.forEach(p => { const mass = Math.pow(p.radius, 3); massRetained[p.targetSieve] += mass; totalMass += mass; });
                
                let cumulativeRetained = 0; let cumulativePctRetainedSum = 0;
                const percentPassing = []; const percentRetainedArr = [];
                
                massRetained.forEach((mass, index) => { 
                    cumulativeRetained += mass; 
                    const passing = ((totalMass - cumulativeRetained) / totalMass) * 100;
                    percentPassing.push(passing); 
                    
                    const cumRetainedPct = (cumulativeRetained / totalMass) * 100;
                    percentRetainedArr.push(cumRetainedPct);
                    
                    // Fineness Modulus ONLY sums #100 sieve and larger. Excludes #200 and Pan.
                    if (this.sieves[index].opening >= 0.15) { cumulativePctRetainedSum += cumRetainedPct; }
                });

                const finenessModulus = cumulativePctRetainedSum / 100;

                // DATA TABLE
                this.ctx.fillStyle = '#1e3a8a'; this.ctx.fillRect(wx+20, wy+50, 280, 25);
                this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 12px Arial'; this.ctx.textAlign = 'left';
                this.ctx.fillText('Sieve', wx+25, wy+67); this.ctx.fillText('Mass(g)', wx+110, wy+67); this.ctx.fillText('% Ret', wx+180, wy+67); this.ctx.fillText('% Pass', wx+240, wy+67);
                
                this.ctx.font = '12px monospace';
                this.sieves.forEach((sieve, i) => {
                    this.ctx.fillStyle = i % 2 === 0 ? '#1e293b' : '#334155';
                    this.ctx.fillRect(wx+20, wy+75 + (i*20), 280, 20); // Compressed rows for 9 sieves
                    this.ctx.fillStyle = '#e1e7ef';
                    this.ctx.fillText(sieve.size.split(' ')[0], wx+25, wy+90 + (i*20)); // Only show # Name
                    
                    const scaledMass = (massRetained[i] / totalMass) * 1000;
                    this.ctx.fillText(scaledMass.toFixed(1), wx+110, wy+90 + (i*20));
                    this.ctx.fillText(percentRetainedArr[i].toFixed(1), wx+180, wy+90 + (i*20));
                    this.ctx.fillStyle = '#4ade80';
                    this.ctx.fillText(percentPassing[i].toFixed(1), wx+240, wy+90 + (i*20));
                });

                // METRICS PANEL
                this.ctx.fillStyle = '#1e3a8a'; this.ctx.fillRect(wx+20, wy+265, 280, 25);
                this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 12px Arial'; this.ctx.fillText('AGGREGATE METRICS', wx+25, wy+282);
                this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(wx+20, wy+290, 280, 80);
                
                this.ctx.fillStyle = '#38bdf8'; this.ctx.font = '14px Arial';
                this.ctx.fillText('Fineness Modulus (FM):', wx+30, wy+320); 
                this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px monospace'; this.ctx.fillText(finenessModulus.toFixed(2), wx+220, wy+321);
                
                let aggType = finenessModulus > 3.5 ? 'Coarse Aggregate' : 'Fine Aggregate';
                this.ctx.fillStyle = '#38bdf8'; this.ctx.font = '14px Arial';
                this.ctx.fillText('Classification:', wx+30, wy+350); 
                this.ctx.fillStyle = '#eab308'; this.ctx.font = 'bold 14px Arial'; this.ctx.fillText(aggType, wx+130, wy+350);

                // Export Button
                this.ctx.fillStyle = '#10b981'; this.ctx.fillRect(wx+20, wy+390, 280, 40);
                this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 14px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('💾 EXPORT ASTM REPORT', wx+160, wy+415);

                // LOGARITHMIC GRAPH
                const gx = wx + 340, gy = wy + 400, gw = 360, gh = 320;
                this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(gx, gy-gh, gw, gh);
                this.ctx.strokeStyle = '#475569'; this.ctx.lineWidth = 1; 
                
                this.ctx.fillStyle = '#94a3b8'; this.ctx.font = '10px Arial'; this.ctx.textAlign = 'right';
                for(let i=0; i<=100; i+=20) { 
                    const y = gy - (i/100)*gh; 
                    this.ctx.fillText(i, gx-5, y+3); 
                    this.ctx.beginPath(); this.ctx.moveTo(gx, y); this.ctx.lineTo(gx+gw, y); this.ctx.stroke(); 
                }
                
                this.ctx.textAlign = 'center';
                const logLabels = [0.1, 1, 10];
                logLabels.forEach(val => {
                    const lx = gx + ((Math.log10(val) + 1.5) / 2.5) * gw;
                    this.ctx.fillText(val.toString(), lx, gy+15);
                    this.ctx.beginPath(); this.ctx.moveTo(lx, gy); this.ctx.lineTo(lx, gy-gh); this.ctx.stroke();
                });

                this.ctx.save(); this.ctx.translate(gx-25, gy-150); this.ctx.rotate(-Math.PI/2); this.ctx.textAlign = 'center'; this.ctx.fillText('Percent Passing (%)', 0, 0); this.ctx.restore();
                this.ctx.textAlign = 'center'; this.ctx.fillText('Sieve Opening Size (mm) - Log Scale', gx+gw/2, gy+35);
                
                this.ctx.strokeStyle = '#10b981'; this.ctx.lineWidth = 3; this.ctx.beginPath();
                const mapX = (opening) => { if (opening === 0) return gx; return gx + ((Math.log10(opening) + 1.5) / 2.5) * gw; };

                const plotPoints = [];
                this.sieves.forEach((sieve, i) => { 
                    const px = mapX(sieve.opening === 0 ? 0.05 : sieve.opening); 
                    const py = gy - (percentPassing[i]/100)*gh; 
                    plotPoints.push({x: px, y: py}); 
                    if(i===0) this.ctx.moveTo(px, py); else this.ctx.lineTo(px, py); 
                });
                this.ctx.stroke();

                plotPoints.forEach((pt) => { 
                    this.ctx.fillStyle = '#ffffff'; this.ctx.beginPath(); this.ctx.arc(pt.x, pt.y, 4, 0, Math.PI*2); this.ctx.fill(); 
                });
            }
        }
        this.screenTexture.needsUpdate = true;
    }

    bindUI() {
        const canvas = document.getElementById('sieveMonitorCanvas');
        canvas.addEventListener('dblclick', (e) => { 
            if(canvas.style.display === 'block' && this.osState === 'desktop') { this.osState = 'software'; this.drawMonitor(this.state.phase === 'done'); } 
        });
        canvas.addEventListener('click', (e) => {
            if(canvas.style.display !== 'block' || this.osState !== 'software') return;
            const rect = canvas.getBoundingClientRect(); const x = (e.clientX - rect.left) * (canvas.width / rect.width); const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            
            if(x > 730 && x < 770 && y > 30 && y < 60) { this.osState = 'desktop'; this.drawMonitor(false); }
            if(this.state.phase === 'done' && x > 20 && x < 300 && y > 390 && y < 430) { window.exportPDFReport('sieveMonitorCanvas', 'Sieve_Analysis_Report'); }
        });

        document.getElementById('pourBtn').onclick = () => { this.state.phase = 'pouring'; document.getElementById('pourBtn').disabled = true; };
        document.getElementById('shakeBtn').onclick = () => { this.state.phase = 'shaking'; this.state.time = 0; document.getElementById('shakeBtn').disabled = true; };
        
        document.getElementById('inspectBtn').onclick = () => {
            this.state.isInspecting = !this.state.isInspecting; const btn = document.getElementById('inspectBtn');
            if(this.state.isInspecting) {
                btn.textContent = "Reassemble Stack [3]"; btn.style.borderColor = "#d946ef"; btn.style.color = "#d946ef";
                // Adjusted fan-out logic for 9 sieves
                this.sieveObjects.forEach((sObj, i) => { 
                    sObj.group.userData.targetOffsetX = (i - 4.0) * 0.45; 
                    sObj.group.userData.targetOffsetY = -0.1 - sObj.group.userData.origY; 
                    sObj.group.userData.targetOffsetZ = 1.0; 
                });
            } else {
                btn.textContent = "Inspect Stack [3]"; btn.style.borderColor = "#8b5cf6"; btn.style.color = "#8b5cf6";
                this.sieveObjects.forEach((sObj) => { sObj.group.userData.targetOffsetX = 0; sObj.group.userData.targetOffsetY = 0; sObj.group.userData.targetOffsetZ = 0; });
            }
        };
        
        document.getElementById('plotBtn').onclick = () => { document.getElementById('plotBtn').disabled = true; this.drawMonitor(true); };
    }

    update(delta) {
        this.sieveObjects.forEach((sObj) => {
            const data = sObj.group.userData; 
            data.currentOffsetX += (data.targetOffsetX - data.currentOffsetX) * 0.08; 
            data.currentOffsetY += (data.targetOffsetY - data.currentOffsetY) * 0.08; 
            data.currentOffsetZ += (data.targetOffsetZ - data.currentOffsetZ) * 0.08;
            sObj.group.position.set(data.currentOffsetX, data.origY + data.currentOffsetY, data.currentOffsetZ);
        });

        if (this.state.phase === 'pouring' || this.state.phase === 'idle') {
            let allPoured = true; const topSieveFloor = this.sieveObjects[0].yFloor;
            for (let i = 0; i < this.particleCount; i++) {
                const p = this.particles[i];
                if (p.currentY > topSieveFloor + p.stackOffset) { 
                    p.fallSpeed += 9.8 * delta * 0.1; p.currentY -= p.fallSpeed; allPoured = false; 
                    if (p.currentY <= topSieveFloor + p.stackOffset) { p.currentY = topSieveFloor + p.stackOffset; p.fallSpeed = 0; } 
                }
                this.updateParticle(i);
            }
            this.particleMesh.instanceMatrix.needsUpdate = true;
            if (this.state.phase === 'pouring' && allPoured) { this.state.phase = 'poured'; document.getElementById('shakeBtn').disabled = false; }
        }

        if (this.state.phase === 'shaking' || this.state.phase === 'done') {
            if (this.state.phase === 'shaking') { 
                this.state.time += delta; 
                this.vibratingGroup.position.set((Math.random() - 0.5) * 0.01, 0.35, (Math.random() - 0.5) * 0.01); 
            }

            for (let i = 0; i < this.particleCount; i++) {
                const p = this.particles[i];
                if (this.state.phase === 'shaking' && !p.isSettled) {
                    p.x += (Math.random() - 0.5) * 0.005; p.z += (Math.random() - 0.5) * 0.005;
                    const maxRadius = 0.3 - p.radius - 0.01; const dist = Math.sqrt(p.x*p.x + p.z*p.z);
                    if (dist > maxRadius && dist > 0) { p.x = (p.x / dist) * maxRadius; p.z = (p.z / dist) * maxRadius; }
                    
                    const targetY = this.sieveObjects[p.targetSieve].yFloor + p.stackOffset;
                    if (p.currentY > targetY) {
                        for(let s=0; s<this.sieves.length; s++) { if(p.currentY >= this.sieveObjects[s].yFloor) { p.currentSieve = s; break; } }
                        if (Math.random() > 0.90) p.currentY -= 0.8 * delta; 
                    } else { 
                        p.currentY = targetY; p.isSettled = true; p.currentSieve = p.targetSieve; 
                    }
                }
                this.updateParticle(i);
            }
            this.particleMesh.instanceMatrix.needsUpdate = true;
            
            if (this.state.phase === 'shaking' && this.state.time > 10) {
                this.state.phase = 'done'; this.vibratingGroup.position.set(0, 0.35, 0); 
                document.getElementById('inspectBtn').disabled = false; document.getElementById('plotBtn').disabled = false;
                if(this.osState === 'software') this.drawMonitor(true);
            }
        }
    }
}