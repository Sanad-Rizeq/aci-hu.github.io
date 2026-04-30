class UTMStation {
    constructor(scene, x, z) {
        this.group = new THREE.Group(); this.group.position.set(x, 0, z);
        this.uiID = 'utmUI'; this.uiVisible = false; this.name = 'Mechanical Testing';
        
        this.testState = { activeMix: null, status: 'IDLE', strain: 0, stress: 0, load: 0, maxLoad: 0, speed: 0.0001, dataPoints: [], hasCracked: false };
        this.osState = 'desktop';
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.motorOsc = null;
        
        this.dustParticles = []; this.shardParticles = [];
        this.dustMesh = null; this.shardMesh = null; 
        this.dummy = new THREE.Object3D();
        this.shakeTimer = 0;

        this.crackOverlay = null; this.crackOverlayL = null; this.crackOverlayR = null;

        this.buildMachine(); scene.add(this.group); this.injectExtraUI(); this.bindUI(); this.resetMachine();
        
        window.addEventListener('inventoryUpdate', () => this.updateDropdown());
        
        setInterval(() => { if(this.osState === 'desktop') this.drawMonitor(false); }, 1000);
    }

    injectExtraUI() {
        const utmUI = document.getElementById('utmUI');
        if (utmUI && !document.getElementById('utmTestMode')) {
            const grp = document.createElement('div');
            grp.className = 'control-group'; grp.style.width = '100%';
            grp.innerHTML = `
                <label class="label">Testing Standard</label>
                <select id="utmTestMode" style="margin-bottom: 10px; background: rgba(0,0,0,0.2); color: white; border: 1px solid #38bdf8; padding: 5px; width: 100%; border-radius: 6px;">
                    <option value="compression">ASTM C39 (Compression)</option>
                    <option value="splitting">ASTM C496 (Splitting Tensile)</option>
                    <option value="tensile">ASTM A370 (Steel Tensile)</option>
                    <option value="flexural">ASTM C78 (Flexural Beam)</option>
                </select>
            `;
            utmUI.insertBefore(grp, utmUI.firstChild);

            document.getElementById('utmTestMode').addEventListener('change', (e) => {
                this.updateDropdown();
                this.loadDefaultSpecimen();
            });
        }
        this.updateDropdown();
    }

    updateDropdown() {
        const select = document.getElementById('utmType');
        const modeEl = document.getElementById('utmTestMode');
        if (!select || !modeEl) return;
        
        const mode = modeEl.value;
        const currentVal = select.value;
        
        select.innerHTML = '';
        
        const addOpt = (val, text, valid) => {
            const opt = document.createElement('option');
            opt.value = val; opt.text = text;
            if (!valid) opt.disabled = true;
            select.appendChild(opt);
        };

        addOpt('cylinder', 'Standard Cylinder (30 MPa)', mode === 'compression' || mode === 'splitting');
        addOpt('cube', 'Standard Cube (40 MPa)', mode === 'compression');
        addOpt('steel', 'Steel Rebar', mode === 'tensile');
        addOpt('beam_rebar', 'Reinforced Beam (Flexural)', mode === 'flexural');
        
        const optGroup = document.createElement('optgroup');
        optGroup.label = "Live Lab Inventory";
        let hasInv = false;
        
        window.LabState.inventory.forEach(mix => {
            if(!mix.tested && !mix.id.toString().startsWith('std_')) {
                hasInv = true;
                const opt = document.createElement('option');
                opt.value = mix.id;
                opt.text = `${mix.name} (Age: ${mix.age || 0}d)`;
                
                let valid = false;
                if (mode === 'compression' && (mix.type === 'cylinder' || mix.type === 'cube')) valid = true;
                if (mode === 'splitting' && mix.type === 'cylinder') valid = true;
                if (mode === 'tensile' && mix.type === 'steel') valid = true;
                if (mode === 'flexural' && mix.type === 'beam_rebar') valid = true;
                
                if (!valid) opt.disabled = true;
                optGroup.appendChild(opt);
            }
        });
        
        if (hasInv) select.appendChild(optGroup);
        
        if (Array.from(select.options).some(o => o.value === currentVal && !o.disabled)) {
            select.value = currentVal;
        } else {
            const firstValid = Array.from(select.options).find(o => !o.disabled);
            if (firstValid) select.value = firstValid.value;
        }
    }

    createDustTexture() {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(200, 210, 220, 1)');
        gradient.addColorStop(0.5, 'rgba(200, 210, 220, 0.5)');
        gradient.addColorStop(1, 'rgba(200, 210, 220, 0)');
        context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    }

    buildMachine() {
        this.group.add(createAntiVibrationMat(2.5, 2.5));
        
        const heavyIronMat = new THREE.MeshPhysicalMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.6, clearcoat: 0.1 }); 
        const accentMat = new THREE.MeshPhysicalMaterial({ color: 0xeab308, roughness: 0.4, metalness: 0.8, clearcoat: 0.5 }); 
        this.matSteel = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2, clearcoat: 0.3 });
        const leadScrewMat = new THREE.MeshPhysicalMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.5, map: createNoiseTexture('#334155') }); 
        const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.2, roughness: 0.1, metalness: 0.9 });

        const baseBottom = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 1.0), heavyIronMat); baseBottom.position.y = 0.1; baseBottom.castShadow = true; this.group.add(baseBottom);
        const baseTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.8), accentMat); baseTop.position.y = 0.35; baseTop.castShadow = true; this.group.add(baseTop);
        const guide1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 32), this.matSteel); guide1.position.set(-0.6, 1.5, -0.2); this.group.add(guide1);
        const guide2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 32), this.matSteel); guide2.position.set(0.6, 1.5, -0.2); this.group.add(guide2);
        const screw1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 32), leadScrewMat); screw1.position.set(-0.6, 1.5, 0.2); this.group.add(screw1);
        const screw2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 32), leadScrewMat); screw2.position.set(0.6, 1.5, 0.2); this.group.add(screw2);
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 0.9), heavyIronMat); top.position.y = 2.7; top.castShadow = true; this.group.add(top);

        this.crosshead = new THREE.Group(); this.crosshead.position.y = 1.6; this.group.add(this.crosshead);
        const crossBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.7), accentMat); crossBody.castShadow = true; this.crosshead.add(crossBody);
        
        const loadCell = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 64), this.matSteel); loadCell.position.y = -0.165; this.crosshead.add(loadCell);

        const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.02), glassMat); doorL.position.set(-0.35, 1.5, 0.4); this.group.add(doorL);
        const doorR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.02), glassMat); doorR.position.set(0.35, 1.5, 0.4); this.group.add(doorR);
        
        this.upperPlaten = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 64), this.matSteel); this.upperPlaten.position.y = -0.235; this.crosshead.add(this.upperPlaten);
        this.lowerPlaten = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 64), this.matSteel); this.lowerPlaten.position.y = 0.53; this.group.add(this.lowerPlaten);
        
        doorL.userData.isUTMLoader = true;
        doorR.userData.isUTMLoader = true;
        baseTop.userData.isUTMLoader = true;
        baseBottom.userData.isUTMLoader = true;
        this.lowerPlaten.userData.isUTMLoader = true;

        this.tensGripBottom = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), heavyIronMat); this.tensGripBottom.position.y = 0.6; this.group.add(this.tensGripBottom);
        this.tensGripTop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), heavyIronMat); this.tensGripTop.position.y = -0.3; this.crosshead.add(this.tensGripTop);
        this.tensGripTop.visible = false; this.tensGripBottom.visible = false;
        
        this.flexuralNose = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 32), this.matSteel); this.flexuralNose.rotation.x = Math.PI/2; this.flexuralNose.position.y = -0.23; this.flexuralNose.visible = false; this.crosshead.add(this.flexuralNose);
        this.flexuralSupports = new THREE.Group(); this.flexuralSupports.position.y = 0.51; this.flexuralSupports.visible = false; this.group.add(this.flexuralSupports);
        const sup1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 32), this.matSteel); sup1.rotation.x = Math.PI/2; sup1.position.set(-0.3, 0.02, 0); this.flexuralSupports.add(sup1);
        const sup2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 32), this.matSteel); sup2.rotation.x = Math.PI/2; sup2.position.set(0.3, 0.02, 0); this.flexuralSupports.add(sup2);

        this.specimenGroup = new THREE.Group(); this.group.add(this.specimenGroup);

        const desk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.6), new THREE.MeshStandardMaterial({color: 0x111111})); desk.position.set(1.6, 0.4, 0.4); desk.castShadow = true; this.group.add(desk);
        const canvas = document.getElementById('utmMonitorCanvas'); this.ctx = canvas.getContext('2d'); this.screenTex = new THREE.CanvasTexture(canvas);
        const monitorGroup = new THREE.Group(); monitorGroup.position.set(1.6, 1.25, 0.4); monitorGroup.rotation.y = -Math.PI / 6; this.group.add(monitorGroup);
        const screenBox = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.05), heavyIronMat); monitorGroup.add(screenBox);
        const display = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.6), new THREE.MeshBasicMaterial({map: this.screenTex})); display.position.z = 0.026; display.userData.isUTMMonitor = true; monitorGroup.add(display);

        this.shardMat = new THREE.MeshStandardMaterial({color: 0x64748b, roughness: 1.0});
        
        this.shardMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.006, 0), this.shardMat, 100);
        this.shardMesh.castShadow = true; this.group.add(this.shardMesh);
        for(let i=0; i<100; i++) this.shardParticles.push({ active: false, x:0, y:0, z:0, vx:0, vy:0, vz:0, rot:0, rotS:0 });

        const dustMat = new THREE.MeshBasicMaterial({ map: this.createDustTexture(), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
        this.dustMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 0.1), dustMat, 50);
        this.group.add(this.dustMesh);
        for(let i=0; i<50; i++) this.dustParticles.push({ active: false, x:0, y:0, z:0, vx:0, vy:0, vz:0, scale:1, life:0 });

        this.graphZoom = 1.0; 
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
        
        if(isSteel) { 
            osc.type = 'square'; osc.frequency.setValueAtTime(1200, this.audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.1); 
            gain.gain.setValueAtTime(1, this.audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15); 
        } else { 
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, this.audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(10, this.audioCtx.currentTime + 0.6); 
            gain.gain.setValueAtTime(2.5, this.audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.6); 
            
            const bufferSize = this.audioCtx.sampleRate * 0.5; const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = this.audioCtx.createBufferSource(); noise.buffer = buffer;
            const noiseFilter = this.audioCtx.createBiquadFilter(); noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 800;
            const noiseGain = this.audioCtx.createGain(); noiseGain.gain.setValueAtTime(1.5, this.audioCtx.currentTime); noiseGain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);
            noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(this.audioCtx.destination); noise.start();
        }
        osc.connect(gain); gain.connect(this.audioCtx.destination); osc.start(); osc.stop(this.audioCtx.currentTime + 0.6);
    }

    resetMachine() {
        this.testState.status = 'IDLE'; this.testState.strain = 0; this.testState.stress = 0; this.testState.load = 0; this.testState.maxLoad = 0; this.testState.dataPoints = []; 
        this.testState.hasCracked = false; 
        this.stopMotorSound(); 
        this.shakeTimer = 0; this.group.position.set(this.group.userData.startX || this.group.position.x, 0, this.group.userData.startZ || this.group.position.z);
        
        this.shardParticles.forEach(p => p.active = false);
        this.dustParticles.forEach(p => p.active = false);
        for(let i=0; i<100; i++) { this.dummy.position.set(0,-100,0); this.dummy.updateMatrix(); this.shardMesh.setMatrixAt(i, this.dummy.matrix); }
        for(let i=0; i<50; i++) { this.dummy.position.set(0,-100,0); this.dummy.updateMatrix(); this.dustMesh.setMatrixAt(i, this.dummy.matrix); }
        this.shardMesh.instanceMatrix.needsUpdate = true; this.dustMesh.instanceMatrix.needsUpdate = true;
        
        while(this.specimenGroup.children.length > 0) this.specimenGroup.remove(this.specimenGroup.children[0]);
        this.testMesh = null;
        this.solidBeam = null;
        this.crackOverlay = null;
        this.crackOverlayL = null;
        this.crackOverlayR = null;

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
        const modeEl = document.getElementById('utmTestMode');
        const mode = modeEl ? modeEl.value : 'compression';
        this.concreteVFXMat = new THREE.MeshStandardMaterial({color: 0x64748b, roughness: 0.9});

        if(typeof scene !== 'undefined') {
            scene.traverse(child => {
                if (child.userData && child.userData.mixData && child.userData.mixData.id === mixData.id && child.parent !== this.specimenGroup) {
                    child.visible = false; 
                }
            });
        }

        if (mixData.type === 'beam_rebar') {
            document.getElementById('utmTestMode').value = 'flexural';
            this.updateDropdown();
            
            this.concreteTransparentMat = new THREE.MeshStandardMaterial({color: 0x64748b, roughness: 0.9, transparent: true, opacity: 0.4}); 
            this.testMesh = new THREE.Group();
            const solidGeom = new THREE.BoxGeometry(0.8, 0.2, 0.2, 16, 4, 4);
            const posArray = solidGeom.attributes.position.array;
            const initialPos = [];
            for(let i=0; i<posArray.length; i+=3) { initialPos.push({x: posArray[i], y: posArray[i+1], z: posArray[i+2]}); }
            solidGeom.userData.initialPositions = initialPos;
            this.solidBeam = new THREE.Mesh(solidGeom, this.concreteTransparentMat);
            this.solidBeam.position.set(0, 0.65, 0); 
            this.testMesh.add(this.solidBeam);

            const geomL = new THREE.BoxGeometry(0.4, 0.2, 0.2, 4, 4, 4);
            const geomR = new THREE.BoxGeometry(0.4, 0.2, 0.2, 4, 4, 4);
            geomL.translate(-0.2, -0.05, 0); geomR.translate(0.2, -0.05, 0);  
            const posL = geomL.attributes.position; const posR = geomR.attributes.position;
            for(let i=0; i<posL.count; i++) {
                if (Math.abs(posL.getX(i)) < 0.001) { 
                    const y = posL.getY(i); const z = posL.getZ(i);
                    if (y < 0) { const jitter = (Math.sin(y * 100) + Math.cos(z * 100)) * 0.025; const damp = Math.abs(y) / 0.15; posL.setX(i, posL.getX(i) + jitter * damp); }
                }
            }
            for(let i=0; i<posR.count; i++) {
                if (Math.abs(posR.getX(i)) < 0.001) { 
                    const y = posR.getY(i); const z = posR.getZ(i);
                    if (y < 0) { const jitter = (Math.sin(y * 100) + Math.cos(z * 100)) * 0.025; const damp = Math.abs(y) / 0.15; posR.setX(i, posR.getX(i) + jitter * damp); }
                }
            }
            geomL.computeVertexNormals(); geomR.computeVertexNormals();
            this.beamHalfL = new THREE.Mesh(geomL, this.concreteVFXMat);
            this.beamHalfR = new THREE.Mesh(geomR, this.concreteVFXMat);
            this.beamHalfL.position.set(0, 0.70, 0); this.beamHalfR.position.set(0, 0.70, 0);
            this.beamHalfL.visible = false; this.beamHalfR.visible = false;
            this.testMesh.add(this.beamHalfL); this.testMesh.add(this.beamHalfR);
            
            const rebarMat = new THREE.MeshStandardMaterial({color: 0x2a2a2a, metalness: 0.8, roughness: 0.6});
            this.rebarGroup = new THREE.Group();
            const barGeom1 = new THREE.CylinderGeometry(0.006, 0.006, 0.76, 8, 32); barGeom1.rotateZ(Math.PI/2);
            const barGeom2 = new THREE.CylinderGeometry(0.006, 0.006, 0.76, 8, 32); barGeom2.rotateZ(Math.PI/2); 
            [barGeom1, barGeom2].forEach(geom => {
                const posArr = geom.attributes.position.array; const iPos = [];
                for(let i=0; i<posArr.length; i+=3) { iPos.push({x: posArr[i], y: posArr[i+1], z: posArr[i+2]}); }
                geom.userData.initialPositions = iPos;
            });
            const bar1 = new THREE.Mesh(barGeom1, rebarMat); bar1.position.set(0, 0, 0.05); this.rebarGroup.add(bar1);
            const bar2 = new THREE.Mesh(barGeom2, rebarMat); bar2.position.set(0, 0, -0.05); this.rebarGroup.add(bar2);
            this.rebarGroup.position.set(0, 0.58, 0); this.rebarGroup.visible = true; 
            this.testMesh.add(this.rebarGroup);
            this.specimenGroup.add(this.testMesh);
            this.upperPlaten.visible = false; this.lowerPlaten.visible = false;
            this.flexuralNose.visible = true; this.flexuralSupports.visible = true;
            this.crosshead.position.y = 1.0; 

            this.testState.activeMix = mixData; 
            this.testState.activeMix.testType = 'flexural';
            this.drawMonitor();
            return true;
        }

        if (isCyl && mode === 'splitting') {
            this.testState.activeMix.testType = 'splitting';
            this.testMesh = new THREE.Group();
            this.splitMeshL = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.3, 64, 1, false, 0, Math.PI), this.concreteVFXMat);
            this.splitMeshR = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.3, 64, 1, false, Math.PI, Math.PI), this.concreteVFXMat);
            this.splitMeshL.rotation.z = Math.PI / 2; this.splitMeshR.rotation.z = Math.PI / 2;
            
            const crackMat = new THREE.MeshStandardMaterial({ map: this.generateCrackTexture(), transparent: true, opacity: 0.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, depthWrite: false });
            this.crackOverlayL = new THREE.Mesh(this.splitMeshL.geometry, crackMat); this.splitMeshL.add(this.crackOverlayL);
            this.crackOverlayR = new THREE.Mesh(this.splitMeshR.geometry, crackMat); this.splitMeshR.add(this.crackOverlayR);

            const splitMeshGroup = new THREE.Group(); splitMeshGroup.add(this.splitMeshL); splitMeshGroup.add(this.splitMeshR); this.testMesh.add(splitMeshGroup);
            
            const woodMat = new THREE.MeshStandardMaterial({color: 0x8b5a2b});
            const topStrip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.02), woodMat); topStrip.position.y = 0.08;
            const botStrip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.02), woodMat); botStrip.position.y = -0.08;
            this.testMesh.add(topStrip); this.testMesh.add(botStrip);

            this.testMesh.position.set(0, 0.65, 0); 
            this.testMesh.rotation.y = (Math.random() - 0.5) * 0.15; 
            this.specimenGroup.add(this.testMesh);
            this.crosshead.position.y = 1.005; 
        } else {
            this.testState.activeMix.testType = 'compression';
            this.testMesh = new THREE.Mesh(
                isCyl ? new THREE.CylinderGeometry(0.075, 0.075, 0.3, 64, 16) : new THREE.BoxGeometry(0.15, 0.15, 0.15, 16, 16, 16),
                this.concreteVFXMat
            );
            
            const crackMat = new THREE.MeshStandardMaterial({ map: this.generateCrackTexture(), transparent: true, opacity: 0.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, depthWrite: false });
            this.crackOverlay = new THREE.Mesh(this.testMesh.geometry, crackMat);
            this.testMesh.add(this.crackOverlay);

            const hOrig = isCyl ? 0.3 : 0.15;
            this.testMesh.position.set(0, 0.56 + (hOrig/2), 0); 
            this.testMesh.rotation.y = (Math.random() - 0.5) * 0.15; 
            this.specimenGroup.add(this.testMesh);
            this.crosshead.position.y = 0.56 + hOrig + 0.265;   
        }
        this.drawMonitor();
        return true;
    }

    loadDefaultSpecimen() {
        this.resetMachine();
        const type = document.getElementById('utmType').value;
        const modeEl = document.getElementById('utmTestMode');
        const mode = modeEl ? modeEl.value : 'compression';
        
        const invItem = window.LabState.inventory.find(i => i.id === type);
        if (invItem) {
            this.loadSpecimenFromHand(invItem);
            return;
        }
        
        this.testState.activeMix = { 
            id: 'std_' + Date.now(), 
            batchId: 'std_batch',
            mixName: 'Default ' + type.toUpperCase(),
            name: type.toUpperCase() + ' (Default Sample)', 
            type: type, 
            targetFc: mode === 'tensile' || type === 'steel' ? 400 : 30,
            currentFc: mode === 'tensile' || type === 'steel' ? 400 : 30, 
            corrosionLevel: 0, 
            testType: mode,
            tested: false,
            age: 28, 
            w: 0, c: 0, g: 0, s: 0,
            slumpMm: 'N/A'
        };
        
        window.LabState.inventory = window.LabState.inventory.filter(i => !(i.id.toString().startsWith('std_') && !i.tested));
        window.LabState.inventory.push(this.testState.activeMix);
        window.dispatchEvent(new Event('inventoryUpdate'));

        this.concreteVFXMat = new THREE.MeshStandardMaterial({color: 0x64748b, roughness: 0.9}); 
        this.concreteTransparentMat = new THREE.MeshStandardMaterial({color: 0x64748b, roughness: 0.9, transparent: true, opacity: 0.4}); 
        
        if (mode === 'tensile' || type === 'steel') {
            this.testMesh = new THREE.Group();
            const rebarMat = new THREE.MeshStandardMaterial({color: 0x334155, metalness: 0.8, roughness: 0.4});
            this.steelTop = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.25, 16, 16), rebarMat); 
            this.steelBot = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.25, 16, 16), rebarMat);
            this.steelBot.position.y = 0.825; this.steelTop.position.y = 1.075; 
            this.steelTop.castShadow = true; this.steelBot.castShadow = true;
            this.testMesh.add(this.steelTop); this.testMesh.add(this.steelBot);
            this.specimenGroup.add(this.testMesh);
            this.upperPlaten.visible = false; this.lowerPlaten.visible = false;
            this.tensGripTop.visible = true; this.tensGripBottom.visible = true;
            this.crosshead.position.y = 1.6;  
            
        } else if (mode === 'flexural' || type === 'beam_rebar') {
            this.testMesh = new THREE.Group();
            const solidGeom = new THREE.BoxGeometry(0.8, 0.2, 0.2, 16, 4, 4);
            const posArray = solidGeom.attributes.position.array;
            const initialPos = [];
            for(let i=0; i<posArray.length; i+=3) { initialPos.push({x: posArray[i], y: posArray[i+1], z: posArray[i+2]}); }
            solidGeom.userData.initialPositions = initialPos;
            this.solidBeam = new THREE.Mesh(solidGeom, this.concreteTransparentMat);
            this.solidBeam.position.set(0, 0.65, 0); 
            this.testMesh.add(this.solidBeam);

            const geomL = new THREE.BoxGeometry(0.4, 0.2, 0.2, 4, 4, 4);
            const geomR = new THREE.BoxGeometry(0.4, 0.2, 0.2, 4, 4, 4);
            geomL.translate(-0.2, -0.05, 0); geomR.translate(0.2, -0.05, 0);  
            const posL = geomL.attributes.position; const posR = geomR.attributes.position;
            for(let i=0; i<posL.count; i++) {
                if (Math.abs(posL.getX(i)) < 0.001) { 
                    const y = posL.getY(i); const z = posL.getZ(i);
                    if (y < 0) { const jitter = (Math.sin(y * 100) + Math.cos(z * 100)) * 0.025; const damp = Math.abs(y) / 0.15; posL.setX(i, posL.getX(i) + jitter * damp); }
                }
            }
            for(let i=0; i<posR.count; i++) {
                if (Math.abs(posR.getX(i)) < 0.001) { 
                    const y = posR.getY(i); const z = posR.getZ(i);
                    if (y < 0) { const jitter = (Math.sin(y * 100) + Math.cos(z * 100)) * 0.025; const damp = Math.abs(y) / 0.15; posR.setX(i, posR.getX(i) + jitter * damp); }
                }
            }
            geomL.computeVertexNormals(); geomR.computeVertexNormals();
            this.beamHalfL = new THREE.Mesh(geomL, this.concreteVFXMat);
            this.beamHalfR = new THREE.Mesh(geomR, this.concreteVFXMat);
            this.beamHalfL.position.set(0, 0.70, 0); this.beamHalfR.position.set(0, 0.70, 0);
            this.beamHalfL.visible = false; this.beamHalfR.visible = false;
            this.testMesh.add(this.beamHalfL); this.testMesh.add(this.beamHalfR);
            
            const rebarMat = new THREE.MeshStandardMaterial({color: 0x2a2a2a, metalness: 0.8, roughness: 0.6});
            this.rebarGroup = new THREE.Group();
            const barGeom1 = new THREE.CylinderGeometry(0.006, 0.006, 0.76, 8, 32); barGeom1.rotateZ(Math.PI/2);
            const barGeom2 = new THREE.CylinderGeometry(0.006, 0.006, 0.76, 8, 32); barGeom2.rotateZ(Math.PI/2); 
            [barGeom1, barGeom2].forEach(geom => {
                const posArr = geom.attributes.position.array; const iPos = [];
                for(let i=0; i<posArr.length; i+=3) { iPos.push({x: posArr[i], y: posArr[i+1], z: posArr[i+2]}); }
                geom.userData.initialPositions = iPos;
            });
            const bar1 = new THREE.Mesh(barGeom1, rebarMat); bar1.position.set(0, 0, 0.05); this.rebarGroup.add(bar1);
            const bar2 = new THREE.Mesh(barGeom2, rebarMat); bar2.position.set(0, 0, -0.05); this.rebarGroup.add(bar2);
            this.rebarGroup.position.set(0, 0.58, 0); this.rebarGroup.visible = true; 
            this.testMesh.add(this.rebarGroup);
            this.specimenGroup.add(this.testMesh);
            this.upperPlaten.visible = false; this.lowerPlaten.visible = false;
            this.flexuralNose.visible = true; this.flexuralSupports.visible = true;
            this.crosshead.position.y = 1.0; 
            
        } else if (type === 'cylinder' && mode === 'splitting') {
            this.testMesh = new THREE.Group();
            this.splitMeshL = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.3, 64, 1, false, 0, Math.PI), this.concreteVFXMat);
            this.splitMeshR = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.3, 64, 1, false, Math.PI, Math.PI), this.concreteVFXMat);
            this.splitMeshL.rotation.z = Math.PI / 2; this.splitMeshR.rotation.z = Math.PI / 2;
            
            const crackMat = new THREE.MeshStandardMaterial({ map: this.generateCrackTexture(), transparent: true, opacity: 0.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, depthWrite: false });
            this.crackOverlayL = new THREE.Mesh(this.splitMeshL.geometry, crackMat); this.splitMeshL.add(this.crackOverlayL);
            this.crackOverlayR = new THREE.Mesh(this.splitMeshR.geometry, crackMat); this.splitMeshR.add(this.crackOverlayR);

            const splitMeshGroup = new THREE.Group(); splitMeshGroup.add(this.splitMeshL); splitMeshGroup.add(this.splitMeshR); this.testMesh.add(splitMeshGroup);
            
            const woodMat = new THREE.MeshStandardMaterial({color: 0x8b5a2b});
            const topStrip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.02), woodMat); topStrip.position.y = 0.08;
            const botStrip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.02), woodMat); botStrip.position.y = -0.08;
            this.testMesh.add(topStrip); this.testMesh.add(botStrip);

            this.testMesh.position.set(0, 0.65, 0); 
            this.testMesh.rotation.y = (Math.random() - 0.5) * 0.15; 
            this.specimenGroup.add(this.testMesh);
            this.crosshead.position.y = 1.005; 
        } else {
            const isCyl = type === 'cylinder';
            this.testMesh = new THREE.Mesh(
                isCyl ? new THREE.CylinderGeometry(0.075, 0.075, 0.3, 64, 16) : new THREE.BoxGeometry(0.15, 0.15, 0.15, 16, 16, 16),
                this.concreteVFXMat
            );
            
            const crackMat = new THREE.MeshStandardMaterial({ map: this.generateCrackTexture(), transparent: true, opacity: 0.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, depthWrite: false });
            this.crackOverlay = new THREE.Mesh(this.testMesh.geometry, crackMat);
            this.testMesh.add(this.crackOverlay);

            const hOrig = isCyl ? 0.3 : 0.15;
            this.testMesh.position.set(0, 0.56 + (hOrig/2), 0); 
            this.testMesh.rotation.y = (Math.random() - 0.5) * 0.15; 
            this.specimenGroup.add(this.testMesh);
            this.crosshead.position.y = 0.56 + hOrig + 0.265;   
        }
        this.drawMonitor();
    }

    drawMonitor(isSoftware = true) {
        this.ctx.fillStyle = '#d4d0c8'; this.ctx.fillRect(0,0,800,600);
        this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(0,0,800,40);
        this.ctx.fillStyle = '#38bdf8'; this.ctx.font = 'bold 20px Arial'; this.ctx.textAlign='left';
        this.ctx.fillText('INSTRON / ACI MECHANICAL TEST SUITE', 20, 28);
        const mix = this.testState.activeMix;
        this.ctx.fillStyle = '#ffffff'; this.ctx.fillRect(20, 60, 760, 70);
        this.ctx.strokeStyle = '#94a3b8'; this.ctx.lineWidth = 2; this.ctx.strokeRect(20, 60, 760, 70);
        this.ctx.fillStyle = '#000000'; this.ctx.font = 'bold 14px monospace';
        const modeStrs = { 'compression': 'COMPRESSION (ASTM C39)', 'splitting': 'SPLIT TENSION (ASTM C496)', 'tensile': 'STEEL TENSION (ASTM A370)', 'flexural': 'FLEXURAL BEAM (ASTM C78)' };
        this.ctx.fillText(`SPECIMEN: ${mix ? mix.name : 'NONE'}`, 40, 85);
        this.ctx.fillText(`MODE:     ${mix ? modeStrs[mix.testType] : 'NONE'}`, 40, 110);
        this.ctx.fillStyle = '#0f172a'; this.ctx.fillRect(20, 140, 200, 200);
        this.ctx.fillStyle = '#4ade80'; this.ctx.font = '20px monospace';
        this.ctx.fillText('LOAD (kN)', 30, 170); this.ctx.fillText(this.testState.load.toFixed(2), 30, 195);
        this.ctx.fillText('STRESS (MPa)', 30, 235); this.ctx.fillText(this.testState.stress.toFixed(2), 30, 260);
        this.ctx.fillText('STRAIN (%)', 30, 300); this.ctx.fillText((this.testState.strain * 100).toFixed(3), 30, 325);
        this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(20, 350, 200, 230);
        this.ctx.fillStyle = '#38bdf8'; this.ctx.font = 'bold 12px Arial';
        this.ctx.fillText('STEP | STRN(%) | STRSS', 25, 370);
        this.ctx.fillStyle = '#e1e7ef'; this.ctx.font = '12px monospace';
        const startIdx = Math.max(0, this.testState.dataPoints.length - 11);
        for(let i = 0; i < 11; i++) {
            if (startIdx + i < this.testState.dataPoints.length) {
                const pt = this.testState.dataPoints[startIdx + i];
                this.ctx.fillText(`${startIdx + i}`.padEnd(4) + ` | ` + `${(pt.strain*100).toFixed(3)}`.padEnd(7) + ` | ` + `${pt.stress.toFixed(2)}`, 25, 395 + (i*18));
            }
        }
        this.ctx.fillStyle = '#ffffff'; this.ctx.fillRect(240, 140, 540, 440);
        const gX = 240, gY = 580, gW = 540, gH = 440;
        const peakStress = mix ? (mix.currentFc || 30) : 30;
        let maxE = 0.004; let maxS = peakStress * 1.5;
        if (mix && mix.testType === 'tensile') { maxE = 0.18; maxS = 650; }
        else if (mix && mix.testType === 'flexural') { maxE = 0.03; maxS = peakStress * 0.3; } 
        else if (mix && mix.testType === 'splitting') { maxE = 0.0025; maxS = Math.max(3, peakStress * 0.15); }
        else if (mix && mix.type === 'cube') { maxE = 0.005; maxS = peakStress * 1.8; }
        maxS = Math.max(5, Math.ceil(maxS / 5) * 5);
        if (!this.graphZoom) this.graphZoom = 1.0;
        const currentMaxE = maxE / this.graphZoom; const currentMaxS = maxS / this.graphZoom;
        this.ctx.strokeStyle = '#cbd5e1'; this.ctx.lineWidth = 1;
        this.ctx.fillStyle = '#000'; this.ctx.font = '12px Arial'; this.ctx.textAlign = 'right';
        for(let i=0; i<=5; i++) { 
            const y = gY - (i/5)*gH; 
            this.ctx.fillText(((i/5)*currentMaxS).toFixed(1), gX - 8, y + 4);
            this.ctx.beginPath(); this.ctx.moveTo(gX, y); this.ctx.lineTo(gX+gW, y); this.ctx.stroke(); 
        }
        this.ctx.textAlign = 'center';
        for(let i=0; i<=5; i++) { 
            const x = gX + (i/5)*gW; 
            this.ctx.fillText(((i/5)*currentMaxE * 100).toFixed(2) + '%', x, gY - gH - 10);
            this.ctx.beginPath(); this.ctx.moveTo(x, gY); this.ctx.lineTo(x, gY-gH); this.ctx.stroke(); 
        }
        this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(gX + gW - 120, gY - gH + 10, 110, 35);
        this.ctx.fillStyle = '#38bdf8'; this.ctx.fillRect(gX + gW - 115, gY - gH + 15, 30, 25); 
        this.ctx.fillStyle = '#ef4444'; this.ctx.fillRect(gX + gW - 80, gY - gH + 15, 30, 25);  
        this.ctx.fillStyle = '#64748b'; this.ctx.fillRect(gX + gW - 45, gY - gH + 15, 30, 25);  
        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText('+', gX + gW - 100, gY - gH + 33);
        this.ctx.fillText('-', gX + gW - 65, gY - gH + 33);
        this.ctx.fillText('R', gX + gW - 30, gY - gH + 33);
        this.ctx.save();
        this.ctx.beginPath(); this.ctx.rect(gX, gY - gH, gW, gH); this.ctx.clip(); 
        this.ctx.beginPath(); 
        this.ctx.strokeStyle = this.testState.status === 'FAILED' || this.testState.status === 'FRACTURED' ? '#ff0000' : '#2563eb'; 
        this.ctx.lineWidth = 3;
        for (let i = 0; i < this.testState.dataPoints.length; i++) {
            let pt = this.testState.dataPoints[i];
            let x = gX + (pt.strain / currentMaxE) * gW; 
            let y = gY - (pt.stress / currentMaxS) * gH; 
            if (i === 0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
        this.ctx.restore();
        if (this.testState.status === 'FAILED' || this.testState.status === 'FRACTURED') {
            this.ctx.fillStyle = 'rgba(239, 68, 68, 0.1)'; this.ctx.fillRect(gX, gY - gH, gW, gH);
            this.ctx.fillStyle = '#ef4444'; this.ctx.font = 'bold 28px Arial'; this.ctx.textAlign = 'center';
            this.ctx.fillText('ULTIMATE FAILURE REACHED', gX + gW/2, gY - gH + 60);
        }
        this.screenTex.needsUpdate = true;
    }

    bindUI() {
        document.getElementById('utmType').onchange = () => this.loadDefaultSpecimen();
        document.getElementById('resetUTM').onclick = () => {
            this.resetMachine();
            this.updateDropdown();
        };
        document.getElementById('utmStartBtn').onclick = () => {
            if(!this.testState.activeMix) this.loadDefaultSpecimen();
            this.testState.status = 'RUNNING';
            document.getElementById('utmStartBtn').disabled = true;
            this.startMotorSound();
        };
        const canvas = document.getElementById('utmMonitorCanvas');
        canvas.addEventListener('click', (e) => {
            if(canvas.style.display !== 'block') return;
            const rect = canvas.getBoundingClientRect(); 
            const x = (e.clientX - rect.left) * (canvas.width / rect.width); 
            const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            const gX = 240, gW = 540, gH = 440, gY = 580;
            const btnY = gY - gH + 15; 
            if (y > btnY && y < btnY + 25) {
                if (x > gX + gW - 115 && x < gX + gW - 85) { this.graphZoom *= 1.5; this.drawMonitor(); } 
                else if (x > gX + gW - 80 && x < gX + gW - 50) { this.graphZoom /= 1.5; this.drawMonitor(); } 
                else if (x > gX + gW - 45 && x < gX + gW - 15) { this.graphZoom = 1.0;  this.drawMonitor(); }
            }
        });
    }

    triggerMicroCrackVFX(yPos) {
        this.playCrackSound(true); 
        for(let i=0; i<15; i++) { 
            let p = this.dustParticles[i]; p.active = true; p.life = 0.5; p.scale = 0.1 + Math.random()*0.2;
            p.x = (Math.random()-0.5)*0.1; p.y = yPos + (Math.random()-0.5)*0.1; p.z = (Math.random()-0.5)*0.1;
            let angle = Math.random() * Math.PI * 2; let speed = 0.2 + Math.random()*0.3;
            p.vx = Math.cos(angle) * speed; p.vz = Math.sin(angle) * speed; p.vy = Math.random() * 0.2;
        }
    }

    triggerFractureVFX(yPos) {
        if(!this.group.userData.startX) { this.group.userData.startX = this.group.position.x; this.group.userData.startZ = this.group.position.z; }
        this.shakeTimer = 0.2;
        for(let i=0; i<100; i++) {
            let p = this.shardParticles[i]; p.active = true;
            p.x = (Math.random()-0.5)*0.1; p.y = yPos + (Math.random()-0.5)*0.15; p.z = (Math.random()-0.5)*0.1;
            let angle = Math.random() * Math.PI * 2; let speed = 2 + Math.random() * 3;
            p.vx = Math.cos(angle) * speed; p.vz = Math.sin(angle) * speed; p.vy = (Math.random() - 0.2) * 2;
            p.rot = Math.random() * Math.PI; p.rotS = (Math.random() - 0.5) * 0.5;
        }
        for(let i=0; i<50; i++) {
            let p = this.dustParticles[i]; p.active = true; p.life = 1.0; p.scale = 0.2 + Math.random()*0.5;
            p.x = (Math.random()-0.5)*0.2; p.y = yPos + (Math.random()-0.5)*0.2; p.z = (Math.random()-0.5)*0.2;
            let angle = Math.random() * Math.PI * 2; let speed = 0.5 + Math.random();
            p.vx = Math.cos(angle) * speed; p.vz = Math.sin(angle) * speed; p.vy = Math.random() * 0.5;
        }
    }

    generateCrackTexture() {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,512,512); 

        ctx.strokeStyle = 'rgba(20, 25, 30, 0.9)'; 
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        for(let c = 0; c < 25; c++) {
            ctx.beginPath();
            let startX = Math.random() * 512;
            let startY = Math.random() * 512;
            ctx.moveTo(startX, startY);
            ctx.lineWidth = 1.5 + Math.random() * 2.5;
            let currentX = startX; let currentY = startY;
            for(let steps = 0; steps < 15; steps++) {
                currentX += (Math.random() - 0.5) * 60;
                currentY += (Math.random() * 60) - 10; 
                ctx.lineTo(currentX, currentY);
            }
            ctx.stroke();
            
            if(Math.random() > 0.5) {
                ctx.beginPath();
                ctx.moveTo(currentX, currentY);
                ctx.lineWidth = 1 + Math.random() * 1.5;
                ctx.lineTo(currentX + (Math.random() - 0.5)*100, currentY + (Math.random() - 0.5)*100);
                ctx.stroke();
            }
        }
        
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    failSpecimen(type) {
        if(this.testState.status === 'FAILED' || this.testState.status === 'FRACTURED') return; 
        this.testState.status = 'FRACTURED';
        this.stopMotorSound();
        let yPosImpact = this.testMesh ? this.testMesh.position.y : 0.6;

        if (this.testState.activeMix && !this.testState.activeMix.tested) {
            this.testState.activeMix.tested = true;
            this.testState.activeMix.ultimateStrength = this.testState.stress; 
            
            this.testState.activeMix.maxLoad = this.testState.maxLoad;
            this.testState.activeMix.ruptureLoad = this.testState.load;
            this.testState.activeMix.maxStrain = this.testState.strain;
            
            window.dispatchEvent(new Event('inventoryUpdate'));
        }

        if (type === 'steel') {
            this.playCrackSound(true);
            const geoTop = new THREE.CylinderGeometry(0.016, 0.005, 0.25, 16, 16); geoTop.computeVertexNormals();
            const geoBot = new THREE.CylinderGeometry(0.005, 0.016, 0.25, 16, 16); geoBot.computeVertexNormals();
            this.steelTop.geometry.dispose(); this.steelBot.geometry.dispose();
            this.steelTop.geometry = geoTop; this.steelBot.geometry = geoBot;
            gsap.to(this.steelTop.position, {y: "+=0.08", duration: 0.05, ease: "bounce.out"});
            gsap.to(this.steelBot.position, {y: "-=0.08", duration: 0.05, ease: "bounce.out"});
            gsap.to(this.crosshead.position, {y: "+=0.08", duration: 0.05, ease: "bounce.out"}); 
            
        } else if (type === 'splitting') {
            this.playCrackSound(false); this.triggerFractureVFX(yPosImpact);
            gsap.to(this.splitMeshL.position, {z: 0.04, duration: 0.1, ease: "power2.out"});
            gsap.to(this.splitMeshL.rotation, {x: -0.1, duration: 0.1});
            gsap.to(this.splitMeshR.position, {z: -0.04, duration: 0.1, ease: "power2.out"});
            gsap.to(this.splitMeshR.rotation, {x: 0.1, duration: 0.1});

        } else if (type === 'beam_rebar') {
            this.playCrackSound(false); this.triggerFractureVFX(0.55); 
            gsap.to(this.beamHalfL.rotation, {z: "-=0.05", duration: 0.1, ease: "bounce.out"});
            gsap.to(this.beamHalfR.rotation, {z: "+=0.05", duration: 0.1, ease: "bounce.out"});
            gsap.to(this.beamHalfL.position, {x: "-=0.01", y: "-=0.02", duration: 0.1});
            gsap.to(this.beamHalfR.position, {x: "+=0.01", y: "-=0.02", duration: 0.1});
            gsap.to(this.rebarGroup.position, {y: "-=0.02", duration: 0.1});
            gsap.to(this.crosshead.position, {y: "-=0.02", duration: 0.1});

        } else if (type === 'cube') {
            this.playCrackSound(false);
            this.triggerFractureVFX(yPosImpact);
            const pos = this.testMesh.geometry.attributes.position;
            const h = 0.15; 
            for(let i=0; i<pos.count; i++) {
                let x = pos.getX(i); let y = pos.getY(i); let z = pos.getZ(i);
                let distFromCenter = Math.abs(y) / (h/2); 
                if (distFromCenter < 0.8) {
                    let pinch = 0.3 + (distFromCenter * 0.7); 
                    pos.setX(i, x * pinch + (Math.random()-0.5)*0.01);
                    pos.setZ(i, z * pinch + (Math.random()-0.5)*0.01);
                }
                pos.setY(i, y * 0.85); 
            }
            this.testMesh.geometry.computeVertexNormals();
            this.testMesh.geometry.attributes.position.needsUpdate = true;
            
            for(let i=0; i<4; i++) {
                let chunk = new THREE.Mesh(new THREE.BoxGeometry(0.04 + Math.random()*0.02, 0.04 + Math.random()*0.02, 0.04 + Math.random()*0.02), this.testMesh.material);
                chunk.position.copy(this.testMesh.position);
                chunk.position.y -= 0.02; 
                let angle = (i * Math.PI / 2) + this.testMesh.rotation.y;
                chunk.position.x += Math.cos(angle) * 0.05;
                chunk.position.z += Math.sin(angle) * 0.05;
                chunk.rotation.y = angle;
                
                this.specimenGroup.add(chunk);
                
                gsap.to(chunk.position, {
                    x: `+=${Math.cos(angle) * (0.15 + Math.random()*0.1)}`, 
                    y: 0.4, 
                    z: `+=${Math.sin(angle) * (0.15 + Math.random()*0.1)}`, 
                    duration: 0.5 + Math.random()*0.2, ease: "bounce.out"
                });
                gsap.to(chunk.rotation, {
                    x: (Math.random()-0.5)*3,
                    z: (Math.random()-0.5)*3,
                    duration: 0.5
                });
            }
            gsap.to(this.crosshead.position, {y: "-=0.04", duration: 0.05});

        } else {
            this.playCrackSound(false); this.triggerFractureVFX(yPosImpact);
            const pos = this.testMesh.geometry.attributes.position;
            const hOrig = 0.3;
            
            for(let i=0; i<pos.count; i++) {
                let x = pos.getX(i); let y = pos.getY(i); let z = pos.getZ(i);
                let normY = y / (hOrig / 2); 

                if (Math.abs(normY) < 0.95) {
                    let radius = Math.sqrt(x*x + z*z);
                    if (radius > 0.001) { 
                        let angle = Math.atan2(z, x);
                        let spallFactor = 1.0 - Math.pow(Math.abs(normY), 1.5); 
                        
                        let shearPlane = Math.abs(Math.sin(angle * 2 + y * 12));

                        if (shearPlane > 0.15) {
                            let pushIn = (Math.random() * 0.03 + 0.01) * spallFactor; 
                            let newRadius = Math.max(0.02, radius - pushIn);
                            pos.setX(i, (x / radius) * newRadius);
                            pos.setZ(i, (z / radius) * newRadius);
                        } else {
                            pos.setX(i, x + (Math.random() - 0.5) * 0.005);
                            pos.setZ(i, z + (Math.random() - 0.5) * 0.005);
                        }
                    }
                }
            }
            this.testMesh.geometry.computeVertexNormals();
            this.testMesh.geometry.attributes.position.needsUpdate = true;
            
            for(let i=0; i<4; i++) {
                let chunk = new THREE.Mesh(new THREE.BoxGeometry(0.04 + Math.random()*0.03, 0.08 + Math.random()*0.05, 0.02 + Math.random()*0.03), this.testMesh.material);
                chunk.position.copy(this.testMesh.position);
                chunk.position.y += (Math.random() - 0.5) * 0.1;
                let angle = Math.random() * Math.PI * 2;
                chunk.position.x += Math.cos(angle) * 0.06;
                chunk.position.z += Math.sin(angle) * 0.06;
                chunk.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
                this.specimenGroup.add(chunk);
                
                gsap.to(chunk.position, {
                    x: `+=${Math.cos(angle) * (0.1 + Math.random()*0.1)}`, 
                    y: 0.4, 
                    z: `+=${Math.sin(angle) * (0.1 + Math.random()*0.1)}`, 
                    duration: 0.5 + Math.random()*0.2, ease: "bounce.out"
                });
                gsap.to(chunk.rotation, { x: "+=2", z: "+=2", duration: 0.5 });
            }

            gsap.to(this.testMesh.scale, {y: 0.9, duration: 0.05}); 
            gsap.to(this.crosshead.position, {y: "-=0.03", duration: 0.05});
        }
        if(this.osState === 'software') this.drawMonitor(true);
    }

    update(delta) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= delta;
            this.group.position.x = this.group.userData.startX + (Math.random() - 0.5) * 0.04;
            this.group.position.z = this.group.userData.startZ + (Math.random() - 0.5) * 0.04;
            if (this.shakeTimer <= 0) { this.group.position.set(this.group.userData.startX, 0, this.group.userData.startZ); }
        }

        if(this.testState.status === 'RUNNING') {
            const mix = this.testState.activeMix;
            const isSteel = mix.testType === 'tensile';
            const isBeam = mix.testType === 'flexural';
            const isSplit = mix.testType === 'splitting';
            let peakStress = mix.currentFc || 30;
            let curStress = 0;
            
            if (isSteel) {
                this.testState.speed = 0.02; this.testState.strain += delta * this.testState.speed;
                let e = this.testState.strain; const E = 200000; const Fy = peakStress; const Fu = 550; 
                const ey = Fy/E; const esh = 0.02; const eu = 0.12; const ef = 0.16;
                if (e <= ey) curStress = e * E; else if (e <= esh) curStress = Fy; 
                else if (e <= eu) { const p = (e-esh)/(eu-esh); curStress = Fy + (Fu-Fy)*Math.sin(p*Math.PI/2); }
                else if (e <= ef) { const p = (e-eu)/(ef-eu); curStress = Fu - (Fu-450)*p; }
                else { curStress = 0; this.failSpecimen('steel'); }
                this.testState.stress = curStress;
            } else if (isBeam) {
                this.testState.speed = 0.002; this.testState.strain += delta * this.testState.speed;
                let e = this.testState.strain; let fcr = peakStress * 0.15; let ecr = 0.0005;
                let fy = peakStress * 0.8; let ey = 0.005; let eu = 0.025;
                if (!this.testState.hasCracked && e >= ecr) { this.testState.hasCracked = true; this.triggerMicroCrackVFX(0.56); this.solidBeam.visible = false; this.beamHalfL.visible = true; this.beamHalfR.visible = true; }
                if (e <= ecr) curStress = (e/ecr) * fcr; else if (e <= ey) curStress = fcr + ((e-ecr)/(ey-ecr))*(fy-fcr);
                else if (e <= eu) curStress = fy + ((e-ey)/(eu-ey))*(fy*0.05); else { curStress = 0; this.failSpecimen('beam_rebar'); }
                this.testState.stress = curStress;
            } else if (isSplit) {
                this.testState.speed = 0.0002; this.testState.strain += delta * this.testState.speed;
                let e = this.testState.strain; let splitStr = 0.56 * Math.sqrt(peakStress); let e0 = 0.001;
                if (e <= e0) curStress = splitStr * (2*(e/e0) - Math.pow(e/e0,2)); else curStress = splitStr - ((e-e0)*(splitStr*100));
                if (curStress <= 0 && e > e0) { curStress = 0; this.failSpecimen('splitting'); }
                this.testState.stress = curStress;
                
                if (this.crackOverlayL && this.crackOverlayR) {
                     let crackProgress = Math.pow(Math.min(1.0, e / (e0 * 1.5)), 3.0);
                     this.crackOverlayL.material.opacity = crackProgress;
                     this.crackOverlayR.material.opacity = crackProgress;
                }
            } else {
                this.testState.speed = 0.0005; this.testState.strain += delta * this.testState.speed;
                let e = this.testState.strain; let fc = peakStress * (mix.type === 'cube' ? 1.2 : 1.0);
                let e0 = 0.002; let ecu = mix.type === 'cube' ? 0.0035 : 0.003;
                
                // Hognestad Stress-Strain Model
                if (e <= e0) curStress = fc * (2*(e/e0) - Math.pow(e/e0,2)); else if (e <= ecu) curStress = fc * (1 - 0.15*((e-e0)/(ecu-e0)));
                else { curStress = 0; this.failSpecimen(mix.type); }
                this.testState.stress = curStress;
                
                if (this.crackOverlay) {
                    let crackProgress = Math.pow(Math.min(1.0, e / ecu), 3.0);
                    this.crackOverlay.material.opacity = crackProgress;
                }
            }

            if(this.testState.status === 'RUNNING') {
                
                let areaFactor = 17.671; 
                if (isSteel) areaFactor = 0.201; 
                else if (isBeam) areaFactor = 13.33; 
                else if (mix.type === 'cube') areaFactor = 22.50; 
                
                this.testState.load = this.testState.stress * areaFactor; 
                this.testState.maxLoad = Math.max(this.testState.maxLoad, this.testState.load);

                this.testState.dataPoints.push({ strain: this.testState.strain, stress: Math.max(0, this.testState.stress) });
                if(this.testMesh) {
                    if (isSteel) { this.steelTop.position.y = 1.075 + (this.testState.strain * 0.2); this.crosshead.position.y = 1.6 + (this.testState.strain * 0.4); } 
                    else if (isBeam) {
                        const drop = 1.2 * this.testState.strain; this.crosshead.position.y = 1.0 - drop;
                        if (this.solidBeam && this.solidBeam.visible) {
                            const pos = this.solidBeam.geometry.attributes.position; const initPos = this.solidBeam.geometry.userData.initialPositions;
                            for(let i=0; i<pos.count; i++) { let x = initPos[i].x; let y = initPos[i].y; let sag = drop * (1 - Math.pow(x / 0.3, 2)); if (Math.abs(x) > 0.3) sag = 0; pos.setY(i, y - sag); }
                            pos.needsUpdate = true; this.solidBeam.geometry.computeVertexNormals();
                        } else if (this.beamHalfL && this.beamHalfL.visible) {
                            let crackProgress = Math.max(0, this.testState.strain - 0.0005); const theta = (drop / 0.3) + (crackProgress * 0.5);
                            this.beamHalfL.rotation.z = -theta; this.beamHalfR.rotation.z = theta;
                            this.beamHalfL.position.y = 0.70 - drop; this.beamHalfR.position.y = 0.70 - drop;
                        }
                        if (this.rebarGroup && this.rebarGroup.visible) {
                            this.rebarGroup.children.forEach(bar => {
                                const pos = bar.geometry.attributes.position; const initPos = bar.geometry.userData.initialPositions;
                                for(let i=0; i<pos.count; i++) { let x = initPos[i].x; let y = initPos[i].y; let sag = (1.2 * this.testState.strain) * (1 - Math.pow(x / 0.3, 2)); if (Math.abs(x) > 0.3) sag = 0; pos.setY(i, y - sag); }
                                pos.needsUpdate = true; bar.geometry.computeVertexNormals();
                            });
                        }
                    } else {
                        const isCube = mix.type === 'cube'; const hOrig = isCube ? 0.15 : 0.3;
                        const heightScale = 1 - this.testState.strain; const bulge = 1 + (this.testState.strain * 0.2); 
                        this.testMesh.scale.set(bulge, heightScale, bulge); 
                        this.testMesh.position.y = 0.56 + (hOrig * heightScale / 2);      
                        this.crosshead.position.y = 0.56 + (hOrig * heightScale) + 0.265; 
                    }
                }
                if(this.osState === 'software') this.drawMonitor(true);
            }
        }

        let shardsNeedUpdate = false; let dustNeedUpdate = false;
        for(let i=0; i<this.shardParticles.length; i++) {
            let p = this.shardParticles[i];
            if(p.active) {
                p.vy -= 9.8 * delta * 0.6; p.x += p.vx * delta; p.y += p.vy * delta; p.z += p.vz * delta; p.rot += p.rotS;
                if(p.y < 0.4) { p.y = 0.4; p.vy *= -0.3; p.vx *= 0.5; p.vz *= 0.5; } 
                this.dummy.position.set(p.x, p.y, p.z); this.dummy.rotation.set(p.rot, p.rot, p.rot); this.dummy.updateMatrix();
                this.shardMesh.setMatrixAt(i, this.dummy.matrix); shardsNeedUpdate = true;
            }
        }
        for(let i=0; i<this.dustParticles.length; i++) {
            let p = this.dustParticles[i];
            if(p.active) {
                p.life -= delta * 0.5; p.x += p.vx * delta; p.y += p.vy * delta; p.z += p.vz * delta; p.scale += delta * 1.5; 
                if (p.life <= 0) { p.active = false; this.dummy.position.set(0,-100,0); }
                else { 
                    this.dummy.position.set(p.x, p.y, p.z); 
                    if (typeof camera !== 'undefined') { this.dummy.lookAt(camera.position); } 
                    else { this.dummy.lookAt(new THREE.Vector3(0, 1.6, 5)); }
                    this.dummy.scale.setScalar(p.scale); 
                }
                this.dummy.updateMatrix(); this.dustMesh.setMatrixAt(i, this.dummy.matrix); dustNeedUpdate = true;
            }
        }
        if(shardsNeedUpdate) this.shardMesh.instanceMatrix.needsUpdate = true;
        if(dustNeedUpdate) this.dustMesh.instanceMatrix.needsUpdate = true;
    }
}