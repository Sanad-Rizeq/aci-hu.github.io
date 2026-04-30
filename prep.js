class PrepStation {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); this.group.position.set(x, 0, z);
        this.uiID = 'prepUI'; this.uiVisible = false; this.name = 'Sample Preparation';
        
        this.batchId = Date.now(); 
        this.castCount = 0; 
        
        this.state = { 
            phase: 'idle', 
            targetMpa: 30, 
            targetSlump: 'Medium (75-100mm)', 
            maxAgg: 19, 
            calcWeights: { c: 0, s: 0, g: 0, w: 0, wc: 0.5, fcr: 37 },
            bowlWeights: { cement: 0, sand: 0, gravel: 0, water: 0, hrwr: 0 }, 
            mixerWeights: { cement: 0, sand: 0, gravel: 0, water: 0, hrwr: 0 },
            trolleyWeights: { cement: 0, sand: 0, gravel: 0, water: 0, hrwr: 0 }, 
            tareOffset: 0,
            mixerRunning: false,
            mixProgress: 0,
            animTimer: 0
        }; 
        
        this.osState = 'desktop';
        this.particles = []; this.history = []; 
        
        for(let i=0; i<1000; i++) {
            this.particles.push({ active: false, x:0, y:0, z:0, vx:0, vy:0, vz:0, life:0, color: new THREE.Color(), type: '' });
        }
        
        this.recalculateACI(); 
        this.buildMachine(); 
        scene.add(this.group); 
        this.injectEcoUI();
        this.bindUI();

        setInterval(() => {
            this.drawMonitor(this.osState === 'software');
            this.updateScaleDisplay();
        }, 500);
    }

    injectEcoUI() {
        const prepUI = document.getElementById('prepUI');
        if(prepUI && !document.getElementById('addHrwrBtn')) {
            const grp = document.createElement('div');
            grp.className = 'control-group';
            grp.innerHTML = `<label class="label">Admixture (HRWR)</label><button id="addHrwrBtn" style="border-color: #10b981; color: white; background: rgba(16, 185, 129, 0.2);">Add Dose [6]</button>`;
            
            const dumpBtn = document.getElementById('dumpBowlBtn');
            if (dumpBtn && dumpBtn.parentNode) {
                prepUI.insertBefore(grp, dumpBtn.parentNode);
            } else {
                prepUI.appendChild(grp);
            }
        }
    }

    // ACI 211.1 Mix Design Calculation
    recalculateACI() {
        const fcr = this.state.targetMpa + 7; 

        let wc = 0.50;
        if (fcr <= 25) wc = 0.62;
        else if (fcr <= 30) wc = 0.55;
        else if (fcr <= 35) wc = 0.48;
        else if (fcr <= 40) wc = 0.43;
        else if (fcr <= 45) wc = 0.38;
        else wc = 0.33;

        let waterPerM3 = 190; 
        if(this.state.maxAgg === 10) waterPerM3 = 205;
        if(this.state.maxAgg === 25) waterPerM3 = 180;

        if (this.state.targetSlump.includes('Low')) waterPerM3 -= 15;
        if (this.state.targetSlump.includes('High')) waterPerM3 += 20;

        const cementPerM3 = waterPerM3 / wc;

        const volWater = waterPerM3 / 1000;
        const volCement = cementPerM3 / (3.15 * 1000); 
        const volAir = 0.02; 
        const volAgg = 1.0 - (volWater + volCement + volAir);

        let fineFraction = 0.40; 
        if(this.state.maxAgg === 10) fineFraction = 0.50;
        if(this.state.maxAgg === 25) fineFraction = 0.35;

        const volFine = volAgg * fineFraction;
        const volCoarse = volAgg * (1 - fineFraction);

        const sandPerM3 = volFine * 2.65 * 1000;
        const gravelPerM3 = volCoarse * 2.70 * 1000;

        // Scaled to 10L laboratory batch
        this.state.calcWeights.w = (waterPerM3 / 100);
        this.state.calcWeights.c = (cementPerM3 / 100);
        this.state.calcWeights.g = (gravelPerM3 / 100);
        this.state.calcWeights.s = (sandPerM3 / 100);
        this.state.calcWeights.wc = wc;
        this.state.calcWeights.fcr = fcr;
    }

    buildMachine() {
        this.group.add(createAntiVibrationMat(6.0, 3.0));

        const tableMat = new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, metalness: 0.1, roughness: 0.2, clearcoat: 0.8 });
        const legMat = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
        const scaleMat = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2, clearcoat: 0.5 });
        const brushedSteelMat = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.5, clearcoat: 0.1, side: THREE.DoubleSide });
        const yellowMotorMat = new THREE.MeshPhysicalMaterial({ color: 0xeab308, metalness: 0.3, roughness: 0.4, clearcoat: 0.6 });
        this.wetConcreteMat = new THREE.MeshPhysicalMaterial({ map: createNoiseTexture('#475569'), roughness: 0.2, metalness: 0.1, clearcoat: 0.8 });

        const table = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 1.0), tableMat); table.position.set(0, 0.8, 0); table.castShadow = true; table.receiveShadow = true; this.group.add(table);
        const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 16);
        [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(pos => { const leg = new THREE.Mesh(legGeo, legMat); leg.position.set(pos[0], 0.4, pos[1]); leg.castShadow = true; this.group.add(leg); });

        const scaleBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.4), scaleMat); scaleBase.position.set(0, 0.835, 0); scaleBase.castShadow = true; this.group.add(scaleBase);
        this.scaleCanvas = document.createElement('canvas'); this.scaleCanvas.width = 128; this.scaleCanvas.height = 64; this.scaleCtx = this.scaleCanvas.getContext('2d'); this.scaleTex = new THREE.CanvasTexture(this.scaleCanvas);
        const scaleScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshBasicMaterial({map: this.scaleTex})); scaleScreen.position.set(0, 0.836, 0.15); scaleScreen.rotation.x = -Math.PI/2; this.group.add(scaleScreen);
        
        this.bowlGroup = new THREE.Group(); this.bowlGroup.position.set(0, 0.92, 0); this.group.add(this.bowlGroup);
        this.bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.1, 0.15, 32, 1, true), brushedSteelMat); this.bowl.castShadow = true; this.bowlGroup.add(this.bowl);
        const bowlBottom = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), brushedSteelMat); bowlBottom.rotation.x = -Math.PI/2; bowlBottom.position.set(0, -0.075, 0); this.bowlGroup.add(bowlBottom);

        const bowlHitbox = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.2, 16), new THREE.MeshBasicMaterial({visible:false})); bowlHitbox.userData.isPrepBowl = true; this.bowlGroup.add(bowlHitbox);
        this.bowlContent = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.15, 32), new THREE.MeshStandardMaterial({color: 0x888888, roughness: 1})); this.bowlContent.position.y = -0.075; this.bowlContent.scale.set(1, 0.01, 1); this.bowlContent.visible = false; this.bowlGroup.add(this.bowlContent);

        this.trowel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 16), new THREE.MeshStandardMaterial({color: 0x8b5a2b}));
        this.trowel.position.set(0, 0.1, 0); this.trowel.rotation.x = Math.PI/4; this.bowlGroup.add(this.trowel);

        const createBag = (x, z, c1, c2, scale) => {
            const tex = document.createElement('canvas'); tex.width=256; tex.height=256; const ctx=tex.getContext('2d'); ctx.fillStyle=c1; ctx.fillRect(0,0,256,256);
            for(let i=0; i<3000; i++){ ctx.fillStyle=c2; ctx.beginPath(); ctx.arc(Math.random()*256, Math.random()*256, Math.random()*scale, 0, Math.PI*2); ctx.fill(); }
            const bagGroup = new THREE.Group(); bagGroup.position.set(x, 0.9, z); this.group.add(bagGroup);
            const sack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: 0xcdba96, roughness: 0.9 })); sack.castShadow = true; bagGroup.add(sack);
            const inside = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.38), new THREE.MeshStandardMaterial({map: new THREE.CanvasTexture(tex)})); inside.rotation.x = -Math.PI/2; inside.position.y = 0.101; bagGroup.add(inside);
            return bagGroup;
        };
        this.bagCem = createBag(-0.7, -0.2, '#94a3b8', '#64748b', 1); this.bagSand = createBag(0.7, -0.2, '#d2b48c', '#a0522d', 2); this.bagGrav = createBag(-0.7, 0.3, '#64748b', '#334155', 6);

        this.mixerGroup = new THREE.Group(); this.mixerGroup.position.set(-1.8, 0, 0); this.group.add(this.mixerGroup);
        const standBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.6), yellowMotorMat); standBase.position.y = 0.05; this.mixerGroup.add(standBase);
        const standArm1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.15), yellowMotorMat); standArm1.position.set(-0.5, 0.5, 0); this.mixerGroup.add(standArm1);
        const standArm2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.15), yellowMotorMat); standArm2.position.set(0.5, 0.5, 0); this.mixerGroup.add(standArm2);

        this.drumPivot = new THREE.Group(); 
        this.drumPivot.position.set(0, 0.9, 0); 
        this.drumPivot.rotation.x = Math.PI / 6; 
        this.mixerGroup.add(this.drumPivot);

        this.drumSpin = new THREE.Group();
        this.drumPivot.add(this.drumSpin);

        const drumBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.2, 0.5, 32), yellowMotorMat); 
        drumBottom.position.y = -0.25; 
        this.drumSpin.add(drumBottom); 

        const drumTop = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.6, 32, 1, true), yellowMotorMat); 
        drumTop.position.y = 0.3; 
        drumTop.material.side = THREE.DoubleSide; 
        this.drumSpin.add(drumTop); 

        this.mixInside = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.1, 32), new THREE.MeshStandardMaterial({color: 0x888888, roughness: 1})); 
        this.mixInside.visible = false; 
        this.drumSpin.add(this.mixInside); 

        const greenMat = new THREE.MeshPhysicalMaterial({color: 0x22c55e, roughness: 0.6, clearcoat: 0.2});
        this.trolleyGroup = new THREE.Group(); this.trolleyGroup.position.set(-3.2, 0, 0); this.group.add(this.trolleyGroup);
        const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.7), brushedSteelMat); bucket.position.y = 0.4; bucket.castShadow = true; this.trolleyGroup.add(bucket);
        const handle1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2), greenMat); handle1.rotation.z = Math.PI/2.2; handle1.position.set(0.2, 0.4, 0.3); this.trolleyGroup.add(handle1);
        const handle2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2), greenMat); handle2.rotation.z = Math.PI/2.2; handle2.position.set(0.2, 0.4, -0.3); this.trolleyGroup.add(handle2);
        this.trolleyMix = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.3, 0.65), this.wetConcreteMat); this.trolleyMix.position.y = 0.4; this.trolleyMix.visible = false; this.trolleyGroup.add(this.trolleyMix);

        const desk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.6), new THREE.MeshStandardMaterial({color: 0x111})); desk.position.set(1.5, 0.4, 0.5); desk.castShadow = true; this.group.add(desk);
        
        const canvas = document.getElementById('prepMonitorCanvas'); this.ctx = canvas.getContext('2d'); this.screenTex = new THREE.CanvasTexture(canvas);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ map: this.screenTex })); screen.position.set(1.5, 1.15, 0.5); screen.rotation.y = -Math.PI / 6; screen.userData.isPrepMonitor = true; this.group.add(screen);

        this.particleMat = new THREE.MeshPhysicalMaterial({color: 0xaaaaaa, roughness: 0.8});
        this.particleMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.015, 0), this.particleMat, 1000); 
        this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); 
        
        const defaultColor = new THREE.Color(0xaaaaaa);
        for(let i=0; i<1000; i++) { this.particleMesh.setColorAt(i, defaultColor); }
        this.particleMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        
        this.group.add(this.particleMesh); 
        this.dummy = new THREE.Object3D();

        this.updateScaleDisplay(); this.drawMonitor(true);
    }

    updateScaleDisplay() {
        this.scaleCtx.fillStyle = '#000'; this.scaleCtx.fillRect(0,0,128,64);
        const total = this.state.bowlWeights.cement + this.state.bowlWeights.sand + this.state.bowlWeights.gravel + this.state.bowlWeights.water + this.state.bowlWeights.hrwr;
        const displayValue = Math.max(0, total - this.state.tareOffset);
        
        this.scaleCtx.fillStyle = '#10b981'; this.scaleCtx.font = 'bold 32px monospace'; this.scaleCtx.textAlign = 'center';
        this.scaleCtx.fillText(displayValue.toFixed(2), 64, 45); this.scaleTex.needsUpdate = true;

        if (total > 0) {
            this.bowlContent.visible = true; const fillLevel = Math.min(total / 25, 1.0); 
            this.bowlContent.scale.set(1, fillLevel, 1); this.bowlContent.position.y = -0.075 + ((0.15 * fillLevel) / 2);
        } else {
            this.bowlContent.visible = false; this.bowlContent.scale.set(1, 0.01, 1);
        }
    }

    triggerPour(type, amount, color, startPos) {
        if(type !== 'mix' && type !== 'trolley') { 
            this.state.bowlWeights[type] += amount; 
            this.bowlContent.visible = true; 
            this.state.mixProgress = 0; 
            this.bowlContent.material = new THREE.MeshStandardMaterial({color: 0xaaaaaa, roughness: 1}); 
        } 
        this.updateScaleDisplay(); this.drawMonitor(true); 
        
        let spawnedCount = 0;
        for(let i=0; i<this.particles.length; i++) {
            let p = this.particles[i];
            if(!p.active) {
                p.active = true; p.life = 1.0; p.type = type; p.color.setHex(color);
                p.x = startPos.x + (Math.random()-0.5)*0.1; p.y = startPos.y + Math.random()*0.2; p.z = startPos.z + (Math.random()-0.5)*0.1;
                p.vx = (0 - startPos.x)*0.05 + (Math.random()-0.5)*0.02; p.vy = Math.random()*0.05; p.vz = (0 - startPos.z)*0.05 + (Math.random()-0.5)*0.02;
                spawnedCount++;
                if (spawnedCount >= 100) break; 
            }
        }
    }

    dumpBowl() {
        if(this.state.phase !== 'idle' || this.state.mixerRunning) return; 
        const total = this.state.bowlWeights.cement + this.state.bowlWeights.sand + this.state.bowlWeights.gravel + this.state.bowlWeights.water;
        if(total === 0) return;
        this.state.phase = 'dumping_bowl';
        
        gsap.to(this.bowlGroup.position, {x: -1.4, y: 1.7, z: 0.2, duration: 1, ease: "power2.inOut"});
        gsap.to(this.bowlGroup.rotation, {z: Math.PI / 1.5, duration: 1, delay: 0.5, ease: "power2.inOut", onComplete: () => {
            this.triggerPour('mix', 0, 0x64748b, {x: -1.4, y: 1.6, z: 0.2});
            
            this.state.mixerWeights.cement += this.state.bowlWeights.cement; this.state.mixerWeights.sand += this.state.bowlWeights.sand;
            this.state.mixerWeights.gravel += this.state.bowlWeights.gravel; this.state.mixerWeights.water += this.state.bowlWeights.water;
            this.state.mixerWeights.hrwr += this.state.bowlWeights.hrwr;
            this.state.bowlWeights = { cement: 0, sand: 0, gravel: 0, water: 0, hrwr: 0 };
            this.state.mixProgress = 0;
            this.state.tareOffset = 0;
            this.updateScaleDisplay(); this.drawMonitor(true); this.mixInside.visible = true;
            this.mixInside.material = new THREE.MeshStandardMaterial({color: 0x888888, roughness: 1}); 
            
            gsap.to(this.bowlGroup.position, {x: 0, y: 0.92, z: 0, duration: 1, delay: 0.5, ease: "power2.inOut"});
            gsap.to(this.bowlGroup.rotation, {z: 0, duration: 1, delay: 0.5, ease: "power2.inOut", onComplete: () => { 
                this.state.phase = 'idle'; 
                const dumpBtn = document.getElementById('dumpBowlBtn');
                if(dumpBtn) dumpBtn.disabled = true; 
            }});
        }});
    }

  dumpMixer() {
        if(this.state.phase !== 'idle') return;
        const mixBtn = document.getElementById('mixerBtn');
        if(this.state.mixerRunning && mixBtn) mixBtn.click(); 
        this.state.phase = 'dumping_mixer';
        
        this.batchId = Date.now();
        this.castCount = 0;

        gsap.to(this.drumPivot.rotation, {x: 0, z: -Math.PI / 3, duration: 1.5, ease: "power2.inOut", onComplete: () => {
            this.triggerPour('trolley', 0, 0x64748b, {x: -2.3, y: 0.8, z: 0});
            this.mixInside.visible = false;
            
            this.state.trolleyWeights = { ...this.state.mixerWeights };
            this.state.mixerWeights = { cement: 0, sand: 0, gravel: 0, water: 0, hrwr: 0 };

            setTimeout(() => {
                this.trolleyMix.visible = true;
                gsap.to(this.drumPivot.rotation, {x: Math.PI / 6, z: 0, duration: 1.5, ease: "power2.inOut", onComplete: () => {
                    this.drawMonitor(true); this.state.phase = 'idle';
                }});
            }, 1000);
        }});
    }

    drawMonitor(isSoftware = false) {
        if (!isSoftware) {
            const grad = this.ctx.createLinearGradient(0, 0, 800, 600);
            grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#1e3a8a');
            this.ctx.fillStyle = grad; this.ctx.fillRect(0,0,800,600);
            
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'; this.ctx.lineWidth = 1;
            for(let i=0; i<800; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(i,0); this.ctx.lineTo(i,600); this.ctx.stroke(); }
            for(let i=0; i<600; i+=40) { this.ctx.beginPath(); this.ctx.moveTo(0,i); this.ctx.lineTo(800,i); this.ctx.stroke(); }

            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; this.ctx.fillRect(30, 30, 80, 80);
            this.ctx.fillStyle = '#cbd5e1'; this.ctx.fillRect(50, 45, 40, 50); this.ctx.fillStyle = '#38bdf8'; this.ctx.fillRect(60, 55, 20, 20);
            this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '12px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('ACI_Mix.exe', 70, 130);

            this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; this.ctx.fillRect(0, 560, 800, 40);
            this.ctx.fillStyle = '#38bdf8'; this.ctx.fillRect(10, 565, 40, 30);
            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText('ACI', 30, 586);
            
            this.screenTex.needsUpdate = true; return;
        }

        this.ctx.fillStyle = '#d4d0c8'; 
        this.ctx.fillRect(0,0,800,600);
        
        this.ctx.fillStyle = '#000080'; this.ctx.fillRect(0,0,800,40);
        this.ctx.fillStyle = '#ffffff'; this.ctx.font = 'bold 18px Arial'; this.ctx.textAlign='left';
        this.ctx.fillText('ACI 211.1 Mix Design & Lab Integration Module v4.0', 15, 26);

        this.ctx.fillStyle = '#ffffff'; this.ctx.fillRect(20, 60, 360, 520);
        this.ctx.strokeStyle = '#808080'; this.ctx.lineWidth = 2; this.ctx.strokeRect(20, 60, 360, 520);
        this.ctx.fillStyle = '#000080'; this.ctx.fillRect(22, 62, 356, 35);
        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px Arial'; this.ctx.textAlign = 'center';
        this.ctx.fillText(`ACI 211.1 MIX DESIGN WIZARD`, 200, 85);

        const drawControl = (y, label, val) => {
            this.ctx.fillStyle = '#000'; this.ctx.font = 'bold 14px Arial'; this.ctx.textAlign = 'left'; this.ctx.fillText(label, 40, y+20);
            this.ctx.fillStyle = '#c0c0c0'; this.ctx.fillRect(200, y, 30, 30); this.ctx.strokeRect(200, y, 30, 30);
            this.ctx.fillStyle = '#000'; this.ctx.textAlign = 'center'; this.ctx.fillText('<', 215, y+20);
            this.ctx.fillStyle = '#008000'; this.ctx.font = 'bold 14px monospace'; this.ctx.fillText(val, 280, y+20);
            this.ctx.fillStyle = '#c0c0c0'; this.ctx.fillRect(330, y, 30, 30); this.ctx.strokeRect(330, y, 30, 30);
            this.ctx.fillStyle = '#000'; this.ctx.font = 'bold 14px Arial'; this.ctx.fillText('>', 345, y+20);
        };

        drawControl(110, "1. Target f'c:", `${this.state.targetMpa} MPa`);
        drawControl(150, "2. Slump:", this.state.targetSlump.split(' ')[0]);
        drawControl(190, "3. Max Agg:", `${this.state.maxAgg} mm`);

        this.ctx.fillStyle = '#000080'; this.ctx.font = 'bold 14px Arial'; this.ctx.textAlign = 'left';
        this.ctx.fillText('ABSOLUTE VOLUME METHOD (1 m³)', 40, 250);
        this.ctx.beginPath(); this.ctx.moveTo(40, 255); this.ctx.lineTo(360, 255); this.ctx.stroke();

        const drawMath = (y, step, formula, result) => {
            this.ctx.fillStyle = '#333'; this.ctx.font = '12px Arial'; this.ctx.fillText(step, 40, y);
            this.ctx.fillStyle = '#000'; this.ctx.font = 'bold 12px monospace'; this.ctx.fillText(formula, 40, y+15);
            this.ctx.fillStyle = '#008000'; this.ctx.textAlign = 'right'; this.ctx.fillText(result, 360, y+15);
            this.ctx.textAlign = 'left';
        }

        drawMath(270, "Step 1: Required Strength", "f'cr = f'c + 7 MPa", `${this.state.calcWeights.fcr} MPa`);
        drawMath(310, "Step 2: Selected W/C Ratio", "From ACI Table 6.3", `${this.state.calcWeights.wc.toFixed(2)}`);
        drawMath(350, "Step 3&4: Water & Cement", "C = W / (W/C)", `W:${(this.state.calcWeights.w*100).toFixed(0)} C:${(this.state.calcWeights.c*100).toFixed(0)}`);
        drawMath(390, "Step 5&6: Aggregate Vol", "V_agg = 1 - V_w - V_c", `S:${(this.state.calcWeights.s*100).toFixed(0)} G:${(this.state.calcWeights.g*100).toFixed(0)}`);

        this.ctx.fillStyle = '#000000'; this.ctx.font = 'bold 14px Arial'; this.ctx.fillText('TARGET LAB BATCH (10L SCALE)', 40, 450);

        const drawReq = (y, name, req) => {
            this.ctx.fillStyle = '#000'; this.ctx.font = 'bold 14px monospace'; this.ctx.fillText(name, 40, y);
            this.ctx.fillStyle = '#000080'; this.ctx.textAlign = 'right'; this.ctx.fillText(`${req.toFixed(2)} kg`, 360, y);
            this.ctx.textAlign = 'left';
        };
        drawReq(480, 'Water [4]:', this.state.calcWeights.w);
        drawReq(500, 'Cement [1]:', this.state.calcWeights.c);
        drawReq(520, 'Sand [2]:', this.state.calcWeights.s);
        drawReq(540, 'Gravel [3]:', this.state.calcWeights.g);

        this.ctx.fillStyle = '#ffffff'; this.ctx.fillRect(400, 60, 380, 520);
        this.ctx.strokeStyle = '#808080'; this.ctx.strokeRect(400, 60, 380, 520);
        this.ctx.fillStyle = '#000080'; this.ctx.fillRect(402, 62, 376, 35);
        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px Arial'; this.ctx.textAlign = 'center';
        this.ctx.fillText(`LIVE DIGITAL SCALE FEED`, 590, 85);

        this.ctx.fillStyle = '#c0c0c0'; this.ctx.fillRect(680, 110, 80, 30); this.ctx.strokeRect(680, 110, 80, 30);
        this.ctx.fillStyle = '#000'; this.ctx.font = 'bold 14px Arial'; this.ctx.fillText('TARE', 720, 130);

        const drawBar = (y, name, current, req) => { 
            this.ctx.fillStyle = '#000'; this.ctx.font = 'bold 14px monospace'; this.ctx.textAlign = 'left'; 
            this.ctx.fillText(`${name} (${current.toFixed(2)} / ${req.toFixed(2)})`, 420, y); 
            
            this.ctx.fillStyle = '#e0e0e0'; this.ctx.fillRect(420, y+10, 340, 15);
            this.ctx.strokeRect(420, y+10, 340, 15);
            
            const pct = Math.min(1.0, current / req);
            this.ctx.fillStyle = pct >= 0.98 && pct <= 1.02 ? '#00ff00' : (pct > 1.02 ? '#ff0000' : '#0000ff');
            if(pct > 0) {
                this.ctx.fillRect(420, y+10, 340 * pct, 15);
            }
        };
        
        const totW = this.state.bowlWeights.water + this.state.mixerWeights.water + this.state.trolleyWeights.water;
        const totC = this.state.bowlWeights.cement + this.state.mixerWeights.cement + this.state.trolleyWeights.cement;
        const totS = this.state.bowlWeights.sand + this.state.mixerWeights.sand + this.state.trolleyWeights.sand;
        const totG = this.state.bowlWeights.gravel + this.state.bowlWeights.gravel + this.state.trolleyWeights.gravel;

        drawBar(160, 'Water Batch', totW, this.state.calcWeights.w);
        drawBar(220, 'Cement Batch', totC, this.state.calcWeights.c);
        drawBar(280, 'Sand Batch', totS, this.state.calcWeights.s);
        drawBar(340, 'Gravel Batch', totG, this.state.calcWeights.g);

        const totalMass = totW + totC + totG + totS;
        const actualWC = totC > 0 ? (totW / totC) : 0;
        
        this.ctx.beginPath(); this.ctx.moveTo(420, 400); this.ctx.lineTo(760, 400); this.ctx.stroke();
        
        this.ctx.fillStyle = '#000'; this.ctx.font = 'bold 16px monospace'; this.ctx.textAlign = 'left'; 
        this.ctx.fillText(`Total Mass in System:`, 420, 440); this.ctx.fillStyle = '#0000ff'; this.ctx.fillText(`${totalMass.toFixed(2)} kg`, 650, 440);
        this.ctx.fillStyle = '#000'; this.ctx.fillText(`Actual W/C Ratio:`, 420, 480); this.ctx.fillStyle = '#0000ff'; this.ctx.fillText(`${actualWC.toFixed(2)}`, 650, 480);
        
        this.ctx.fillStyle = '#008000'; this.ctx.fillRect(420, 520, 340, 40); 
        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText(' BATCH COMPLETED', 590, 545);

        this.screenTex.needsUpdate = true;
    }

    bindUI() {
        const canvas = document.getElementById('prepMonitorCanvas');
        if (canvas) {
            canvas.addEventListener('dblclick', (e) => {
                if(canvas.style.display !== 'block') return;
                if (this.osState === 'desktop') { this.osState = 'software'; this.drawMonitor(true); }
            });

            canvas.addEventListener('click', (e) => {
                if(canvas.style.display !== 'block') return;
                const rect = canvas.getBoundingClientRect(); const x = (e.clientX - rect.left) * (canvas.width / rect.width); const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                if (this.osState === 'software') { 
                    if(x > 760 && x < 800 && y > 0 && y < 40) { this.osState = 'desktop'; this.drawMonitor(false); }
                    
                    if(x > 180 && x < 250 && y > 100 && y < 145) { this.state.targetMpa = Math.max(15, this.state.targetMpa - 5); this.recalculateACI(); this.drawMonitor(true); }
                    if(x > 310 && x < 380 && y > 100 && y < 145) { this.state.targetMpa = Math.min(60, this.state.targetMpa + 5); this.recalculateACI(); this.drawMonitor(true); }
                    
                    if(x > 180 && x < 250 && y > 145 && y < 185) { const m = ['Low (25-50mm)', 'Medium (75-100mm)', 'High (150-175mm)']; this.state.targetSlump = m[(m.indexOf(this.state.targetSlump) + 2) % 3]; this.recalculateACI(); this.drawMonitor(true); }
                    if(x > 310 && x < 380 && y > 145 && y < 185) { const m = ['Low (25-50mm)', 'Medium (75-100mm)', 'High (150-175mm)']; this.state.targetSlump = m[(m.indexOf(this.state.targetSlump) + 1) % 3]; this.recalculateACI(); this.drawMonitor(true); }
                    
                    if(x > 180 && x < 250 && y > 185 && y < 230) { const m = [10, 19, 25]; this.state.maxAgg = m[(m.indexOf(this.state.maxAgg) + 2) % 3]; this.recalculateACI(); this.drawMonitor(true); }
                    if(x > 310 && x < 380 && y > 185 && y < 230) { const m = [10, 19, 25]; this.state.maxAgg = m[(m.indexOf(this.state.maxAgg) + 1) % 3]; this.recalculateACI(); this.drawMonitor(true); }

                    if(x > 680 && x < 760 && y > 110 && y < 140) {
                        this.state.tareOffset = this.state.bowlWeights.cement + this.state.bowlWeights.sand + this.state.bowlWeights.gravel + this.state.bowlWeights.water + this.state.bowlWeights.hrwr;
                        this.updateScaleDisplay();
                    }
                }
            });
        }

        const getAmt = () => {
            const el = document.getElementById('prepAmt');
            return el ? (parseFloat(el.value) || 1.0) : 1.0;
        };

        const safeBind = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.onclick = fn;
        };

        safeBind('addCementBtn', () => this.triggerPour('cement', getAmt(), 0x94a3b8, this.bagCem.position));
        safeBind('addSandBtn', () => this.triggerPour('sand', getAmt(), 0xd2b48c, this.bagSand.position));
        safeBind('addGravelBtn', () => this.triggerPour('gravel', getAmt(), 0x475569, this.bagGrav.position));
        safeBind('addWaterBtn', () => this.triggerPour('water', getAmt(), 0x38bdf8, {x:0, y:1.5, z:0}));
        safeBind('dumpBowlBtn', () => this.dumpBowl());
        safeBind('dumpMixerBtn', () => this.dumpMixer());
        
        safeBind('mixerBtn', () => {
            this.state.mixerRunning = !this.state.mixerRunning; 
            const btn = document.getElementById('mixerBtn');
            if(btn) {
                btn.textContent = this.state.mixerRunning ? " Stop [5]" : " Mix [5]"; 
                btn.style.borderColor = this.state.mixerRunning ? "var(--lab-warning)" : "var(--lab-success)";
            }
        });

        safeBind('resetPrepBtn', () => {
            this.state.mixerWeights = { cement: 0, sand: 0, gravel: 0, water: 0, hrwr: 0 };
            this.state.trolleyWeights = { cement: 0, sand: 0, gravel: 0, water: 0, hrwr: 0 };
            this.trolleyMix.visible = false;
            this.castCount = 0;
            this.drawMonitor(true);
        });

        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'addHrwrBtn') {
                this.triggerPour('hrwr', getAmt() * 0.1, 0x10b981, {x:0, y:1.5, z:0}); 
            }
        });

        const castItem = (type) => {
            const w = this.state.trolleyWeights.water; 
            const c = this.state.trolleyWeights.cement; 
            const g = this.state.trolleyWeights.gravel; 
            const s = this.state.trolleyWeights.sand;
            const hrwr = this.state.trolleyWeights.hrwr;
            const total = w + c + g + s + hrwr;
            
            if (total > 0 && this.trolleyMix.visible) {
                const geom = (type === 'cylinder') ? new THREE.CylinderGeometry(0.075, 0.075, 0.3, 32) : 
                             (type === 'cube') ? new THREE.BoxGeometry(0.15, 0.15, 0.15) : 
                             new THREE.BoxGeometry(0.8, 0.2, 0.2); 
                             
                const mesh = new THREE.Mesh(geom, this.wetConcreteMat.clone()); 
                mesh.castShadow = true;
                
                const actualWC = c > 0 ? (w / c) : 0;
                let estSlumpMm = this.state.targetSlump.includes('Low') ? 40 : (this.state.targetSlump.includes('High') ? 160 : 85);
                if(actualWC > 0.6) estSlumpMm += 50;
                if(hrwr > 0) estSlumpMm += 60;

                let predFc = 100 / (Math.pow(4, actualWC)); 
                if (hrwr > 0) predFc *= 1.15;

                const mixNameInput = document.getElementById('prepMixName');
                const specPrefixInput = document.getElementById('prepSpecPrefix');
                const mixDesignName = mixNameInput ? mixNameInput.value : "Custom Mix";
                const specPrefix = specPrefixInput ? specPrefixInput.value : "Sample";
                
                this.castCount++;
                
                const specName = `${specPrefix}-${this.castCount}`;

                const mixData = { 
                    id: Date.now().toString().slice(-4), 
                    batchId: this.batchId,
                    mixName: mixDesignName,
                    name: specName, 
                    type: type, 
                    targetFc: predFc,
                    currentFc: 0, 
                    slumpMm: estSlumpMm,
                    age: 0, 
                    w: w.toFixed(1), c: c.toFixed(1), g: g.toFixed(1), s: s.toFixed(1),
                    corrosionLevel: 0,
                    tested: false,
                    testResults: []
                };
                
                mesh.userData.isGrabbableCylinder = true; mesh.userData.mixData = mixData;
                
                let tankObj = null;
                if (typeof stations !== 'undefined') {
                    const curStation = stations.find(st => st.id === 'curing');
                    if (curStation) tankObj = curStation.obj;
                }

                if (tankObj) {
                    const yPos = (type === 'cylinder') ? 0.35 : (type === 'cube' ? 0.275 : 0.3);
                    
                    let placed = false;
                    let xPos = 0, zPos = 0;
                    
                    for (let attempt = 0; attempt < 100; attempt++) {
                        xPos = -1.3 + Math.random() * 2.6; 
                        zPos = -0.6 + Math.random() * 1.2; 
                        
                        let overlap = false;
                        for (let existing of tankObj.cylindersInTank) {
                            let dx = existing.position.x - xPos;
                            let dz = existing.position.z - zPos;
                            let dist = Math.sqrt(dx*dx + dz*dz);
                            
                            let myRadius = (type === 'beam_rebar') ? 0.45 : 0.08;
                            let theirRadius = (existing.userData.mixData.type === 'beam_rebar') ? 0.45 : 0.08;
                            
                            if (dist < (myRadius + theirRadius + 0.02)) {
                                overlap = true;
                                break;
                            }
                        }
                        if (!overlap) {
                            placed = true;
                            break;
                        }
                    }
                    
                    mesh.position.set(xPos, yPos, zPos);
                    tankObj.group.add(mesh);
                    tankObj.cylindersInTank.push(mesh);
                } else {
                    const xOffset = (Math.random() - 0.5) * 0.4;
                    const zOffset = (Math.random() - 0.5) * 0.3;
                    const yOffset = (type === 'cylinder') ? 0.15 : 0.075;
                    mesh.position.set(xOffset, 0.825 + yOffset, 0.2 + zOffset); 
                    this.group.add(mesh);
                }
                
                window.LabState.inventory.push(mixData); 
                this.history.push(mixData); 
                window.dispatchEvent(new Event('inventoryUpdate'));
                
            }
        };
        
        safeBind('castCylBtn', () => castItem('cylinder'));
        safeBind('castCubeBtn', () => castItem('cube'));
        safeBind('castBeamBtn', () => castItem('beam_rebar'));
    }

    update(delta) {
        if (this.state.mixerRunning) { 
            this.drumSpin.rotation.y += 2.0 * delta; 
            if(this.mixInside.visible && this.mixInside.material.type !== "MeshPhysicalMaterial") {
                this.state.mixProgress += delta * 0.1; 
                if(this.state.mixProgress > 1.0) {
                    this.state.mixProgress = 1.0;
                    this.mixInside.material = this.wetConcreteMat;
                    const dumpMixerBtn = document.getElementById('dumpMixerBtn');
                    if(dumpMixerBtn) dumpMixerBtn.disabled = false;
                }
            }
        }
        
        const totalBowlMass = this.state.bowlWeights.cement + this.state.bowlWeights.sand + this.state.bowlWeights.gravel + this.state.bowlWeights.water + this.state.bowlWeights.hrwr;
        const dumpBowlBtn = document.getElementById('dumpBowlBtn');
        if(dumpBowlBtn) dumpBowlBtn.disabled = totalBowlMass === 0 || this.state.phase !== 'idle';

        let needsUpdate = false;
        for(let i=0; i<this.particles.length; i++) {
            let p = this.particles[i]; 
            if(p.active) {
                p.vy -= 9.8 * delta * 0.1; 
                p.x += p.vx; p.y += p.vy; p.z += p.vz; p.life -= delta * 2;
                
                if(p.type === 'trolley') { if(p.y < 0.5) p.life = 0; } 
                else if (p.type === 'mix') { if(p.y < 1.0) p.life = 0; } 
                else { 
                    if(p.y < 0.95 && Math.abs(p.x) < 0.15 && Math.abs(p.z) < 0.15) { p.life = 0; } 
                    if(p.y < 0.8) p.life = 0; 
                }
                
                if(p.life <= 0) { 
                    p.active = false;
                    this.dummy.position.set(0, -100, 0); this.dummy.updateMatrix(); 
                    this.particleMesh.setMatrixAt(i, this.dummy.matrix); 
                } else { 
                    this.dummy.position.set(p.x, p.y, p.z); this.dummy.scale.setScalar(p.life); 
                    this.dummy.updateMatrix(); this.particleMesh.setMatrixAt(i, this.dummy.matrix); 
                    this.particleMesh.setColorAt(i, p.color);
                }
                needsUpdate = true;
            }
        }
        if (needsUpdate) {
            this.particleMesh.instanceMatrix.needsUpdate = true;
            if(this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
        }
    }
}