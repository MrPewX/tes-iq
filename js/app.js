document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const btnScanTab = document.getElementById('btn-scan'), btnManualTab = document.getElementById('btn-manual');
    const scanView = document.getElementById('scan-view'), manualView = document.getElementById('manual-view');
    const matrixA = document.getElementById('matrix-container'), matrixB = document.getElementById('matrix-container-b');
    const matrixBSection = document.getElementById('matrix-b-section'), rowsInput = document.getElementById('rows'), colsInput = document.getElementById('cols');
    const updateGridBtn = document.getElementById('update-grid'), captureBtn = document.getElementById('capture-btn'), operationSelect = document.getElementById('matrix-operation');
    const resultPanel = document.getElementById('result-panel'), closeResult = document.getElementById('close-result');
    const recommendedAnswer = document.getElementById('recommended-answer'), patternReasoning = document.getElementById('pattern-reasoning'), detectedMatrixView = document.getElementById('detected-matrix-view');
    const video = document.getElementById('camera-feed'), canvas = document.getElementById('capture-canvas');
    const loadingState = document.querySelector('.loading-state'), dataState = document.querySelector('.data-state');

    // Extra Controls
    const extraControls = document.getElementById('extra-controls'), plusMinusControl = document.getElementById('plus-minus-control'), toggleOpBtn = document.getElementById('toggle-op');
    const powerControl = document.getElementById('power-control'), powerInput = document.getElementById('matrix-pow-val');

    let currentMode = 'scan', stream = null, currentPlusMinus = '+';

    // --- MATH UTILS ---
    function formatFraction(val) { if (Math.abs(val) < 1e-10) return "0"; try { const f = math.fraction(val); return f.d === 1 ? f.s * f.n : `${f.s === -1 ? '-' : ''}${f.n}/${f.d}`; } catch (e) { return val.toFixed(2); } }
    
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

    function formatMatrixHTML(m, notes = [], augIdx = 0) {
        let html = `<div style="width:100%; overflow-x:auto; margin:10px 0; padding-bottom:10px;"><div style="display:inline-flex; align-items:center; min-width:100%; justify-content:center; gap:10px; padding:0 20px;">`;
        html += `<div style="border-left:2px solid #fff; border-right:2px solid #fff; padding:0 8px;">`;
        m.forEach((row, i) => {
            html += `<div style="display:flex; gap:12px; height:28px; align-items:center;">`;
            row.forEach((cell, j) => {
                if (augIdx > 0 && j === augIdx) html += `<div style="width:1px; height:20px; background:rgba(255,255,255,0.2); margin:0 5px;"></div>`;
                let color = (i===j) ? "#f1c40f" : "#00d4ff"; // Diagonal Highlight
                html += `<span style="color:${color}; min-width:42px; text-align:center; font-size:0.75rem;">${formatFraction(cell)}</span>`;
            });
            html += `</div>`;
        });
        html += `</div><div style="display:flex; flex-direction:column; justify-content:center; padding-left:10px;">`;
        m.forEach((_, i) => html += `<div style="height:28px; display:flex; align-items:center; color:#ff00c8; font-size:0.7rem; font-weight:700;">${notes[i] || ""}</div>`);
        return html + `</div></div></div>`;
    }

    // --- SMART DETERMINANT SOLVER ---
    function solveMatrixSmart(matrixA, matrixB, op) {
        let A = JSON.parse(JSON.stringify(matrixA));
        let r = A.length, c = A[0].length;
        let stepsHTML = `<div style="padding-top:10px; text-align:center;">`;

        function logStep(msg, m, notes = [], aug = 0) {
            stepsHTML += `<div style="margin-bottom:20px; padding:10px; border-radius:12px; background:rgba(255,255,255,0.02);">`;
            stepsHTML += `<p style="font-size:0.6rem; color:var(--secondary); font-weight:800;">[ ${msg} ]</p>`;
            stepsHTML += formatMatrixHTML(m, notes, aug);
            stepsHTML += `</div><div style="margin-bottom:10px; opacity:0.3;">↓</div>`;
        }

        if (op === 'determinant') {
            if (r !== c) throw new Error("Determinant hanya untuk matriks persegi.");
            let swapCount = 0;
            
            if (isTriangular(A)) {
                logStep("MATRIKS SUDAH SEGITIGA (PINTAS)", A);
            } else {
                logStep("MATRIKS AWAL (REDUKSI SEGITIGA ATAS)", A);
                for (let j = 0; j < c; j++) {
                    let maxR = j;
                    for (let i = j + 1; i < r; i++) if (Math.abs(A[i][j]) > Math.abs(A[maxR][j])) maxR = i;
                    if (Math.abs(A[maxR][j]) < 1e-10) continue;
                    if (maxR !== j) { [A[j], A[maxR]] = [A[maxR], A[j]]; swapCount++; logStep("TUKAR BARIS", A, {[j]:`R${j+1} ↔ R${maxR+1}`}); }
                    let notes = [];
                    for (let i = j + 1; i < r; i++) {
                        let f = A[i][j] / A[j][j];
                        if (Math.abs(f) > 1e-10) { A[i] = A[i].map((x,idx) => x - f * A[j][idx]); notes[i] = `R${i+1}-(${formatFraction(f)})R${j+1}`; }
                    }
                    if (notes.length > 0) logStep("ELIMINASI BAWAH", A, notes);
                    if (isTriangular(A)) { logStep("BENTUK SEGITIGA TERBENTUK", A); break; }
                }
            }

            let diag = []; let finalDet = Math.pow(-1, swapCount);
            for(let i=0; i<r; i++) { diag.push(A[i][i]); finalDet *= A[i][i]; }
            let formulaStr = `(-1)<sup>${swapCount}</sup> × (${diag.map(v=>formatFraction(v)).join(" × ")})`;
            stepsHTML += `<div style="border-top:2px solid var(--primary); padding-top:20px; background:rgba(0,129,255,0.05); padding:15px; border-radius:15px;">`;
            stepsHTML += `<h2>Δ = ${formatFraction(finalDet)}</h2>`;
            stepsHTML += `<p style="font-size:0.75rem; color:var(--text-dim); margin-top:5px;">Δ = ${formulaStr} = ${formatFraction(finalDet)}</p></div>`;
            return stepsHTML;

        } else if (op === 'inverse') {
            // Augmented logic...
            for(let i=0; i<r; i++) { for(let j=0; j<r; j++) A[i].push(i===j? 1 : 0); }
            logStep("AUGMENTED MATRIX [A | I]", A, [], r);
            let p = 0;
            for(let j=0; j<r && p<r; j++) {
                let mx = p;
                for(let i=p+1; i<r; i++) if(Math.abs(A[i][j])>Math.abs(A[mx][j])) mx=i;
                if(Math.abs(A[mx][j])<1e-10) continue;
                if(mx!==p) {[A[p],A[mx]]=[A[mx],A[p]]; logStep("SWAP", A, {[p]:`R${p+1}↔R${mx+1}`}, r);}
                let dv = A[p][j];
                if(Math.abs(dv-1)>1e-10) {A[p]=A[p].map(x=>x/dv); logStep("NORMALISASI", A, {[p]:`R${p+1}/(${formatFraction(dv)})`}, r);}
                for(let i=0; i<r; i++) {
                    if(i!==p) { let f=A[i][j]; if(Math.abs(f)>1e-10) {A[i]=A[i].map((x,ix)=>x-f*A[p][ix]);} }
                }
                logStep("ELIMINASI", A, [], r);
                p++;
            }
            stepsHTML += `<h3>INVERSE RESULT (A⁻¹):</h3>` + formatMatrixHTML(A.map(row=>row.slice(r)));
            return stepsHTML;
        } else if (op === 'addition') {
            let res = (currentPlusMinus === '+') ? math.add(A, matrixB) : math.subtract(A, matrixB);
            stepsHTML += `<h3>RESULT (A ${currentPlusMinus} B):</h3>` + formatMatrixHTML(res); return stepsHTML;
        } else if (op === 'multiplication') {
            stepsHTML += `<h3>RESULT (A × B):</h3>` + formatMatrixHTML(math.multiply(A, matrixB)); return stepsHTML;
        } else if (op === 'power') {
            stepsHTML += `<h3>RESULT (A<sup>${powerInput.value}</sup>):</h3>` + formatMatrixHTML(math.pow(A, Number(powerInput.value))); return stepsHTML;
        } else {
            return stepsHTML + `<h3>RESULT (Aᵀ):</h3>` + formatMatrixHTML(math.transpose(A));
        }
    }

    // --- UI ACTIONS ---
    captureBtn.addEventListener('click', async () => {
        resultPanel.classList.remove('hidden'); setTimeout(() => { resultPanel.classList.add('show'); document.querySelector('.panel-content').scrollTop = 0; }, 10);
        loadingState.classList.remove('hidden'); dataState.classList.add('hidden');
        try {
            let mA, mB = null;
            if (currentMode === 'manual') {
                mA = getMatrixFromGrid(matrixA, rowsInput.value, colsInput.value);
                if (['addition', 'multiplication'].includes(operationSelect.value)) mB = getMatrixFromGrid(matrixB, rowsInput.value, colsInput.value);
            } else {
                const ctx = canvas.getContext('2d'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const eng = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng'); mA = reconstructMatrix(eng.data.words);
            }
            patternReasoning.innerHTML = solveMatrixSmart(mA, mB, operationSelect.value);
            recommendedAnswer.innerHTML = "DONE";
            loadingState.classList.add('hidden'); dataState.classList.remove('hidden');
        } catch (e) { patternReasoning.textContent = e.message; loadingState.classList.add('hidden'); dataState.classList.remove('hidden'); }
    });

    operationSelect.addEventListener('change', () => {
        const op = operationSelect.value;
        extraControls.classList.add('hidden'); plusMinusControl.classList.add('hidden'); powerControl.classList.add('hidden'); matrixBSection.classList.add('hidden');
        if (op === 'addition') { extraControls.classList.remove('hidden'); plusMinusControl.classList.remove('hidden'); matrixBSection.classList.remove('hidden'); if(currentMode==='manual') createGrid(matrixB, rowsInput.value, colsInput.value); }
        else if (op === 'multiplication') { matrixBSection.classList.remove('hidden'); if(currentMode==='manual') createGrid(matrixB, rowsInput.value, colsInput.value); }
        else if (op === 'power') { extraControls.classList.remove('hidden'); powerControl.classList.remove('hidden'); }
    });

    toggleOpBtn.addEventListener('click', () => { currentPlusMinus = (currentPlusMinus === '+') ? '-' : '+'; toggleOpBtn.textContent = (currentPlusMinus === '+') ? '+ (Tambah)' : '- (Kurang)'; });
    updateGridBtn.addEventListener('click', () => createGrid(matrixA, Number(rowsInput.value), Number(colsInput.value)));
    function createGrid(c, r, col) { c.innerHTML = ''; c.style.gridTemplateColumns = `repeat(${col}, 50px)`; for(let i=0; i<r*col; i++) { const ins = document.createElement('input'); ins.type = 'number'; ins.className = 'matrix-cell'; ins.value = '0'; c.appendChild(ins); } }
    function getMatrixFromGrid(c, r, col) { const ins = c.querySelectorAll('input'); const m = []; for(let i=0; i<r; i++) { const row = []; for(let j=0; j<col; j++) row.push(Number(ins[i*col+j].value)); m.push(row); } return m; }
    function reconstructMatrix(words) { const numbers = words.filter(w => /^-?\d+([.,]\d+)?$/.test(w.text)); if (numbers.length === 0) return null; const rows = []; numbers.forEach(num => { let found = false; for (let row of rows) { const avgY = row.reduce((sum, n) => sum + n.bbox.y0, 0) / row.length; if (Math.abs(num.bbox.y0 - avgY) < (num.bbox.y1 - num.bbox.y0) * 0.8) { row.push(num); found = true; break; } } if (!found) rows.push([num]); }); rows.sort((a,b)=>a[0].bbox.y0-b[0].bbox.y0); return rows.map(r => { r.sort((a,b)=>a.bbox.x0 - b.bbox.x0); return r.map(n=>Number(n.text.replace(',','.'))); }); }
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(s=>{video.srcObject=s; stream=s;});
    closeResult.addEventListener('click', ()=>{resultPanel.classList.remove('show'); setTimeout(()=>resultPanel.classList.add('hidden'), 500);});
    createGrid(matrixA, 3, 3);
});
