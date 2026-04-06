document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const btnScanTab = document.getElementById('btn-scan'), btnManualTab = document.getElementById('btn-manual');
    const scanView = document.getElementById('scan-view'), manualView = document.getElementById('manual-view');
    const matrixA = document.getElementById('matrix-container'), matrixB = document.getElementById('matrix-container-b');
    const matrixBSection = document.getElementById('matrix-b-section'), rowsInput = document.getElementById('rows'), colsInput = document.getElementById('cols');
    const updateGridBtn = document.getElementById('update-grid'), captureBtn = document.getElementById('capture-btn'), operationSelect = document.getElementById('matrix-operation');
    const resultPanel = document.getElementById('result-panel'), closeResult = document.getElementById('close-result');
    const recommendedAnswer = document.getElementById('recommended-answer'), patternReasoning = document.getElementById('pattern-reasoning'), detectedMatrixView = document.getElementById('detected-matrix-view');
    const video = document.getElementById('camera-feed'), canvas = document.getElementById('capture-canvas');
    const loadingState = document.querySelector('.loading-state'), dataState = document.querySelector('.data-state');

    // Controls
    const extraControls = document.getElementById('extra-controls'), plusMinusControl = document.getElementById('plus-minus-control'), toggleOpBtn = document.getElementById('toggle-op');
    const powerControl = document.getElementById('power-control'), powerInput = document.getElementById('matrix-pow-val');

    let currentMode = 'scan', stream = null, currentPlusMinus = '+';

    // --- MATH UTILS ---
    function formatFraction(val) {
        if (Math.abs(val) < 1e-10) return "0";
        try {
            const f = math.fraction(val);
            return f.d === 1 ? f.s * f.n : `${f.s === -1 ? '-' : ''}${f.n}/${f.d}`;
        } catch (e) { return val.toFixed(2); }
    }

    function isTriangular(A) {
        let n = A.length; let isUpper = true, isLower = true;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i > j && Math.abs(A[i][j]) > 1e-10) isUpper = false;
                if (i < j && Math.abs(A[i][j]) > 1e-10) isLower = false;
            }
        }
        return isUpper || isLower;
    }

    function formatMatrixHTML(matrix, notes = [], isAug = false, augIdx = 0) {
        let rows = matrix.length, cols = matrix[0].length;
        let html = `<div style="width:100%; overflow-x:auto; margin:15px 0; padding-bottom:10px;"><div style="display:inline-flex; align-items:center; min-width:100%; justify-content:center; gap:10px; padding:0 20px;">`;
        
        // Matrix Part
        html += `<div style="border-left:2px solid #fff; border-right:2px solid #fff; padding:0 10px; display:inline-block;">`;
        matrix.forEach((row, i) => {
            html += `<div style="display:flex; gap:12px; height:32px; align-items:center; white-space:nowrap;">`;
            row.forEach((cell, j) => {
                if (isAug && j === augIdx) {
                    html += `<div style="width:1px; height:20px; background:rgba(255,255,255,0.4); margin:0 5px;"></div>`;
                }
                let color = (i===j && j < (isAug ? augIdx : cols)) ? "#f1c40f" : "#00d4ff"; 
                html += `<span style="color:${color}; min-width:45px; text-align:center; font-size:0.8rem;">${formatFraction(cell)}</span>`;
            });
            html += `</div>`;
        });
        html += `</div>`;

        // Notes Part (Side by Side)
        html += `<div style="display:flex; flex-direction:column; justify-content:center; padding-left:15px; border-left:1px dashed #444;">`;
        matrix.forEach((_, i) => html += `<div style="height:32px; display:flex; align-items:center; color:#ff00c8; font-size:0.75rem; font-weight:700; white-space:nowrap;">${notes[i] || ""}</div>`);
        return html + `</div></div></div>`;
    }

    // --- FULL OBE ENGINE ---
    function solveMatrixSmart(matA, matB, op) {
        let A = JSON.parse(JSON.stringify(matA)), r = A.length, c = A[0].length, steps = "";
        let isInv = (op === 'inverse'), isGJ = (op === 'gauss-jordan');
        let swapCount = 0, augIdx = c;

        function log(msg, m, notes = []) { steps += `<div style="margin-bottom:25px; padding:15px; border-radius:15px; background:rgba(255,255,255,0.02);"><p style="font-size:0.65rem; color:var(--secondary); font-weight:800; text-transform:uppercase;">[ ${msg} ]</p>${formatMatrixHTML(m, notes, (isInv || isGJ), augIdx)}</div><div style="opacity:0.3; margin-bottom:15px;">↓</div>`; }

        if (isInv) { // [A | I]
            if (r !== c) throw new Error("Inverse hanya untuk matriks persegi.");
            for(let i=0; i<r; i++) { for(let j=0; j<r; j++) A[i].push(i===j?1:0); }
            c = A[0].length; log("AUGMENTED MATRIX [A | I]", A);
        } else if (isGJ) { // [A | B]
            if (!matB) throw new Error("Pilih menu MANUAL untuk Gauss-Jordan.");
            A.forEach((row,i) => row.push(matB[i][0]));
            c = A[0].length; augIdx = c - 1; log("AUGMENTED MATRIX [A | B]", A);
        }

        if (op === 'determinant') {
            if (r !== c) throw new Error("Matrix harus persegi.");
            log("AWAL", A);
            if (!isTriangular(A)) {
                for (let j = 0; j < c; j++) {
                    let bestPivot = -1;
                    // 1. Prioritaskan baris yang mengandung 1 Utama atau -1
                    for (let i = j; i < r; i++) {
                        if (Math.abs(A[i][j] - 1) < 1e-10 || Math.abs(A[i][j] + 1) < 1e-10) {
                            bestPivot = i;
                            break;
                        }
                    }

                    if (bestPivot !== -1) {
                        if (bestPivot !== j) {
                            [A[j], A[bestPivot]] = [A[bestPivot], A[j]];
                            swapCount++;
                            log("TUKAR BARIS", A, {[j]: `R${j+1}↔R${bestPivot+1} (Dapatkan 1 Utama)`});
                        }
                    } else {
                        // 2. Jika tidak ada 1/-1, cari yang nilai absolutnya paling besar
                        let mx = j;
                        for (let i = j + 1; i < r; i++) if (Math.abs(A[i][j]) > Math.abs(A[mx][j])) mx = i;
                        if (Math.abs(A[mx][j]) < 1e-10) continue;
                        if (mx !== j) { 
                            [A[j], A[mx]] = [A[mx], A[j]]; 
                            swapCount++; 
                            log("TUKAR BARIS", A, {[j]:`R${j+1}↔R${mx+1}`}); 
                        }
                    }

                    // 3. Proses Eliminasi untuk membentuk Matriks Segitiga
                    let ns = [];
                    for (let i = j + 1; i < r; i++) {
                        let f = A[i][j] / A[j][j];
                        if (Math.abs(f) > 1e-10) { 
                            A[i] = A[i].map((x, ix) => x - f * A[j][ix]); 
                            ns[i] = `R${i+1}-(${formatFraction(f)})R${j+1}`; 
                        }
                    }
                    if (ns.length > 0) log("ELIMINASI BAWAH (Bentuk Segitiga)", A, ns);
                }
            }
            let dArr=[]; let dVal=Math.pow(-1, swapCount); for(let i=0; i<r; i++) { dArr.push(A[i][i]); dVal*=A[i][i]; }
            steps += `<div style="border:2px solid var(--primary); padding:15px; border-radius:15px;"><h2>Δ = ${formatFraction(dVal)}</h2><p style="font-size:0.75rem;">Δ = (-1)<sup>${swapCount}</sup> × (${dArr.map(v=>formatFraction(v)).join(" × ")})</p></div>`;
        } else if (isInv || isGJ) {
            let p = 0;
            for (let j = 0; j < augIdx && p < r; j++) {
                let foundPivot = -1;

                // 1. Cari baris dari p sampai r yang memiliki angka 1 (Ideal untuk OBE)
                for (let i = p; i < r; i++) {
                    if (Math.abs(A[i][j] - 1) < 1e-10) {
                        foundPivot = i;
                        break;
                    }
                }

                // 2. Jika tidak ada 1, cari baris yang memiliki angka -1 (Bisa jadi 1 dengan dikali -1)
                if (foundPivot === -1) {
                    for (let i = p; i < r; i++) {
                        if (Math.abs(A[i][j] + 1) < 1e-10) {
                            foundPivot = i;
                            break;
                        }
                    }
                }

                // 3. Jika ketemu 1 atau -1, lakukan tukar baris ke posisi p (jika belum di p)
                if (foundPivot !== -1) {
                    if (foundPivot !== p) {
                        [A[p], A[foundPivot]] = [A[foundPivot], A[p]];
                        log("TUKAR BARIS", A, {[p]: `R${p+1}↔R${foundPivot+1} (Cari 1 Utama)`});
                    }
                } else {
                    // 4. Jika tetap tidak ada 1/-1, cari baris non-zero mana saja (utamakan yang terbesar)
                    let pivotVal = A[p][j];
                    if (Math.abs(pivotVal) < 1e-10) {
                        let swapRow = -1;
                        for (let i = p + 1; i < r; i++) {
                            if (Math.abs(A[i][j]) > 1e-10) {
                                if (swapRow === -1 || Math.abs(A[i][j]) > Math.abs(A[swapRow][j])) swapRow = i;
                            }
                        }
                        if (swapRow === -1) continue; // Kolom ini semua nol, skip
                        [A[p], A[swapRow]] = [A[swapRow], A[p]];
                        log("TUKAR BARIS", A, {[p]: `R${p+1}↔R${swapRow+1}`});
                    }
                }

                // Normalisasi pivot jadi 1 (jika belum 1)
                let div = A[p][j];
                if (Math.abs(div - 1) > 1e-10) {
                    A[p] = A[p].map(x => x / div);
                    log("NORMALISASI", A, {[p]: `R${p+1} ÷ (${formatFraction(div)})`});
                }
                
                // Eliminasi kolom
                let ns = [];
                for (let i = 0; i < r; i++) {
                    if (i !== p) {
                        let f = A[i][j];
                        if (Math.abs(f) > 1e-10) { A[i] = A[i].map((x, idx) => x - f * A[p][idx]); ns[i] = `R${i+1}-(${formatFraction(f)})R${p+1}`; }
                    }
                }
                if (ns.length > 0) log("ELIMINASI KOLOM", A, ns);
                p++;
            }
            steps += `<h3 style="color:var(--secondary);">SELESAI (BENTUK ESELON)</h3>` + formatMatrixHTML(A.map(row => row.slice(isGJ?0:augIdx)));
        } else if (op === 'addition') {
            steps += `<h3>RESULT (A ${currentPlusMinus} B):</h3>` + formatMatrixHTML( (currentPlusMinus==='+')?math.add(matA,matB):math.subtract(matA,matB) );
        } else if (op === 'multiplication') {
            steps += `<h3>RESULT (A × B):</h3>` + formatMatrixHTML(math.multiply(matA,matB));
        } else if (op === 'power') {
            steps += `<h3>RESULT (A<sup>${powerInput.value}</sup>):</h3>` + formatMatrixHTML(math.pow(matA, Number(powerInput.value)));
        } else if (op === 'transpose') {
            steps += `<h3>RESULT (Aᵀ):</h3>` + formatMatrixHTML(math.transpose(matA));
        } else if (op === 'rank') {
            steps += `<h3>MATRIX RANK: ${math.rank(matA)}</h3>`;
        }
        return steps;
    }

    // --- UI LOGIC ---
    function createGrid(c, r, col) {
        c.innerHTML = ''; c.style.gridTemplateColumns = `repeat(${col}, 55px)`;
        for(let i=0; i<r*col; i++) { const ins = document.createElement('input'); ins.type = 'number'; ins.className = 'matrix-cell'; ins.value = '0'; c.appendChild(ins); }
    }

    function refreshGrids() {
        const r = parseInt(rowsInput.value), c = parseInt(colsInput.value);
        createGrid(matrixA, r, c);
        if (['addition', 'multiplication', 'gauss-jordan'].includes(operationSelect.value)) {
            matrixBSection.classList.remove('hidden'); createGrid(matrixB, r, (operationSelect.value === 'gauss-jordan' ? 1 : c));
        } else { matrixBSection.classList.add('hidden'); }
    }

    btnManualTab.addEventListener('click', () => { currentMode = 'manual'; btnScanTab.classList.remove('active'); btnManualTab.classList.add('active'); scanView.classList.add('hidden'); manualView.classList.remove('hidden'); refreshGrids(); });
    btnScanTab.addEventListener('click', () => { currentMode = 'scan'; btnScanTab.classList.add('active'); btnManualTab.classList.remove('active'); scanView.classList.remove('hidden'); manualView.classList.add('hidden'); });
    updateGridBtn.addEventListener('click', refreshGrids);
    operationSelect.addEventListener('change', () => {
        const op = operationSelect.value;
        extraControls.classList.add('hidden'); plusMinusControl.classList.add('hidden'); powerControl.classList.add('hidden');
        if (op === 'addition') { extraControls.classList.remove('hidden'); plusMinusControl.classList.remove('hidden'); }
        else if (op === 'power') { extraControls.classList.remove('hidden'); powerControl.classList.remove('hidden'); }
        if (currentMode === 'manual') refreshGrids();
    });

    toggleOpBtn.addEventListener('click', () => { currentPlusMinus = (currentPlusMinus === '+') ? '-' : '+'; toggleOpBtn.textContent = (currentPlusMinus === '+') ? '+ (Tambah)' : '- (Kurang)'; });

    captureBtn.addEventListener('click', async () => {
        resultPanel.classList.remove('hidden'); setTimeout(() => { resultPanel.classList.add('show'); document.querySelector('.panel-content').scrollTop = 0; }, 10);
        loadingState.classList.remove('hidden'); dataState.classList.add('hidden');
        try {
            let mA, mB = null; const r = parseInt(rowsInput.value), c = parseInt(colsInput.value);
            if (currentMode === 'manual') {
                const insA = matrixA.querySelectorAll('input'); mA = []; for(let i=0; i<r; i++) { let row = []; for(let j=0; j<c; j++) row.push(Number(insA[i*c+j].value)); mA.push(row); }
                if (['addition', 'multiplication', 'gauss-jordan'].includes(operationSelect.value)) {
                    const insB = matrixB.querySelectorAll('input'); 
                    let bCols = (operationSelect.value === 'gauss-jordan') ? 1 : c;
                    mB = []; for(let i=0; i<r; i++) { let row = []; for(let j=0; j<bCols; j++) row.push(Number(insB[i*bCols+j].value)); mB.push(row); }
                }
            } else {
                const ctx = canvas.getContext('2d'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const eng = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng'); mA = reconstructMatrix(eng.data.words);
            }
            if(!mA) throw new Error("Angka matriks tidak terbaca.");
            patternReasoning.innerHTML = solveMatrixSmart(mA, mB, operationSelect.value);
            recommendedAnswer.innerHTML = "DONE";
            loadingState.classList.add('hidden'); dataState.classList.remove('hidden');
        } catch (e) { patternReasoning.textContent = e.message; loadingState.classList.add('hidden'); dataState.classList.remove('hidden'); }
    });

    function reconstructMatrix(words) { const numbers = words.filter(w => /^-?\d+([.,]\d+)?$/.test(w.text)); if (numbers.length === 0) return null; const rows = []; numbers.forEach(num => { let found = false; for (let row of rows) { const avgY = row.reduce((sum, n) => sum + n.bbox.y0, 0) / row.length; if (Math.abs(num.bbox.y0 - avgY) < (num.bbox.y1 - num.bbox.y0) * 0.8) { row.push(num); found = true; break; } } if (!found) rows.push([num]); }); rows.sort((a,b)=>a[0].bbox.y0-b[0].bbox.y0); return rows.map(r => { r.sort((a,b)=>a.bbox.x0 - b.bbox.x0); return r.map(n=>Number(n.text.replace(',','.'))); }); }
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(s=>{video.srcObject=s; stream=s;}).catch(e=>console.log("Cam off"));
    closeResult.addEventListener('click', ()=>{resultPanel.classList.remove('show'); setTimeout(()=>resultPanel.classList.add('hidden'), 500);});
    createGrid(matrixA, 3, 3);
});
