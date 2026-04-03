document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const btnScanTab = document.getElementById('btn-scan');
    const btnManualTab = document.getElementById('btn-manual');
    const scanView = document.getElementById('scan-view');
    const manualView = document.getElementById('manual-view');
    const btnText = document.getElementById('btn-text');
    const matrixA = document.getElementById('matrix-container');
    const rowsInput = document.getElementById('rows');
    const colsInput = document.getElementById('cols');
    const updateGridBtn = document.getElementById('update-grid');
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('capture-canvas');
    const captureBtn = document.getElementById('capture-btn');
    const resultPanel = document.getElementById('result-panel');
    const closeResult = document.getElementById('close-result');
    const operationSelect = document.getElementById('matrix-operation');
    const recommendedAnswer = document.getElementById('recommended-answer');
    const patternReasoning = document.getElementById('pattern-reasoning');
    const loadingState = document.querySelector('.loading-state');
    const dataState = document.querySelector('.data-state');

    let currentMode = 'scan';
    let stream = null;

    // --- MATH UTILS ---
    function formatFraction(val) {
        if (Math.abs(val) < 1e-10) return "0";
        try {
            const f = math.fraction(val);
            return f.d === 1 ? f.s * f.n : `${f.s === -1 ? '-' : ''}${f.n}/${f.d}`;
        } catch (e) { return val.toFixed(2); }
    }

    function isTriangular(A) {
        let n = A.length;
        let isUpper = true, isLower = true;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i > j && Math.abs(A[i][j]) > 1e-10) isUpper = false;
                if (i < j && Math.abs(A[i][j]) > 1e-10) isLower = false;
            }
        }
        return isUpper || isLower;
    }

    function formatMatrixHTML(matrix, notes = [], augmented = false) {
        let rows = matrix.length;
        let cols = matrix[0].length;
        let html = `<div style="width:100%; overflow-x:auto; margin:10px 0; padding-bottom:10px;">`;
        html += `<div style="display:inline-flex; align-items:center; min-width:100%; justify-content:center; gap:10px; padding:0 20px;">`;
        
        // Matrix Part
        html += `<div style="border-left:2px solid #fff; border-right:2px solid #fff; padding:0 5px; position:relative;">`;
        matrix.forEach((row, i) => {
            html += `<div style="display:flex; gap:12px; height:30px; align-items:center;">`;
            row.forEach((cell, j) => {
                if (augmented && j === cols - 1) {
                    html += `<div style="width:1px; height:20px; background:rgba(255,255,255,0.4); margin:0 5px;"></div>`;
                }
                let color = (i === j) ? "#f1c40f" : "#00d4ff"; 
                html += `<span style="color:${color}; min-width:42px; text-align:center; font-size:0.75rem;">${formatFraction(cell)}</span>`;
            });
            html += `</div>`;
        });
        html += `</div>`;

        // OBE Notes Part
        html += `<div style="display:flex; flex-direction:column; justify-content:center; padding-left:10px; border-left:1px dashed #444;">`;
        matrix.forEach((_, i) => {
            html += `<div style="height:30px; display:flex; align-items:center; color:#ff00c8; font-size:0.7rem; font-weight:700; white-space:nowrap;">${notes[i] || ""}</div>`;
        });
        html += `</div></div></div>`;
        return html;
    }

    // --- SOLVER ENGINE ---
    function solveMatrixComplex(originalMatrix, op) {
        let A = JSON.parse(JSON.stringify(originalMatrix));
        let r = A.length, c = A[0].length;
        let stepsHTML = `<div style="padding-top:10px; text-align:center;">`;
        let swapCount = 0;
        let isGaussJordan = (op === 'gauss-jordan');

        function logStep(msg, matrix, notes) {
            stepsHTML += `<div style="margin-bottom:20px; padding:10px 0; background:rgba(255,255,255,0.02); border-radius:12px;">`;
            stepsHTML += `<p style="font-size:0.6rem; color:var(--secondary); font-weight:800; text-transform:uppercase;">[ ${msg} ]</p>`;
            stepsHTML += formatMatrixHTML(matrix, notes, isGaussJordan);
            stepsHTML += `</div>`;
            stepsHTML += `<div style="color:var(--text-dim); margin-bottom:10px;">↓</div>`;
        }

        logStep("MATRIKS AWAL", A, []);

        if (op === 'determinant') {
            if (r !== c) throw new Error("Matrix harus persegi.");
            if (!isTriangular(A)) {
                for (let j = 0; j < c; j++) {
                    let maxR = j;
                    for(let i=j+1; i<r; i++) if(Math.abs(A[i][j]) > Math.abs(A[maxR][j])) maxR = i;
                    if(Math.abs(A[maxR][j]) < 1e-10) continue;
                    if(maxR !== j) { [A[j], A[maxR]] = [A[maxR], A[j]]; swapCount++; logStep("TUKAR BARIS", A, {[j]:`R${j+1} ↔ R${maxR+1}`}); }
                    let notes = [];
                    for(let i=j+1; i<r; i++) {
                        let f = A[i][j] / A[j][j];
                        if(Math.abs(f) > 1e-10) { A[i] = A[i].map((x,idx) => x - f * A[j][idx]); notes[i] = `R${i+1}-(${formatFraction(f)})R${j+1}`; }
                    }
                    if(notes.length > 0) logStep("ELIMINASI BAWAH", A, notes);
                }
            } else { logStep("SDH BENTUK SEGITIGA", A, []); }

            let diag = []; let termDet = Math.pow(-1, swapCount);
            for(let i=0; i<r; i++) diag.push(A[i][i]);
            let totalDet = termDet * diag.reduce((p,v)=>p*v, 1);
            
            let formulaStr = `(${termDet}) × ${diag.map(v => `(${formatFraction(v)})`).join(" × ")}`;

            stepsHTML += `<div style="border-top:2px solid var(--primary); padding-top:20px; background:rgba(0,129,255,0.05); border-radius:15px; padding:15px;">`;
            stepsHTML += `<h2 style="color:#fff; font-weight:800; margin-bottom:10px;">Δ = ${formatFraction(totalDet)}</h2>`;
            stepsHTML += `<p style="font-size:0.75rem; color:var(--text-dim);">Rumus: Δ = (-1)<sup>${swapCount}</sup> × Produk Diagonal</p>`;
            stepsHTML += `<p style="font-size:0.8rem; color:var(--secondary); font-weight:600; margin-top:5px;">Δ = ${formulaStr} = ${formatFraction(totalDet)}</p>`;
            stepsHTML += `</div>`;

        } else if (isGaussJordan) {
            let pivot = 0;
            for(let j=0; j < c-1 && pivot < r; j++) {
                let maxR = pivot;
                for(let i=pivot+1; i<r; i++) if(Math.abs(A[i][j]) > Math.abs(A[maxR][j])) maxR = i;
                if(Math.abs(A[maxR][j]) < 1e-10) continue;
                if(maxR !== pivot) { [A[pivot], A[maxR]] = [A[maxR], A[pivot]]; logStep("SWAP", A, {[pivot]:`R${pivot+1} ↔ R${maxR+1}`}); }
                let div = A[pivot][j];
                if(Math.abs(div-1) > 1e-10) { A[pivot] = A[pivot].map(x => x/div); logStep("NORMALISASI", A, {[pivot]:`R${pivot+1} / ${formatFraction(div)}`}); }
                let ns = [];
                for(let i=0; i<r; i++) {
                    if(i !== pivot) {
                        let f = A[i][j];
                        if(Math.abs(f) > 1e-10) { A[i] = A[i].map((x,idx) => x - f * A[pivot][idx]); ns[i] = `R${i+1}-(${formatFraction(f)})R${pivot+1}`; }
                    }
                }
                if(ns.length > 0) logStep("ELIMINASI", A, ns);
                pivot++;
            }
            stepsHTML += `<div style="border-top:2px solid var(--primary); padding-top:20px;"><h3>GAUSS-JORDAN DONE</h3></div>`;
        }

        return stepsHTML + `</div>`;
    }

    // --- UI & GRID LOGIC ---
    function createGrid(container, r, c) {
        container.innerHTML = ''; container.style.gridTemplateColumns = `repeat(${c}, 50px)`;
        for(let i=0; i < r*c; i++) {
            const input = document.createElement('input'); 
            input.type = 'number'; input.className = 'matrix-cell'; input.value = '0';
            container.appendChild(input);
        }
    }
    updateGridBtn.addEventListener('click', () => createGrid(matrixA, Number(rowsInput.value), Number(colsInput.value)));

    captureBtn.addEventListener('click', async () => {
        resultPanel.classList.remove('hidden');
        setTimeout(() => { resultPanel.classList.add('show'); document.querySelector('.panel-content').scrollTop = 0; }, 10);
        loadingState.classList.remove('hidden'); dataState.classList.add('hidden');
        try {
            let m;
            if (currentMode === 'scan') {
                const ctx = canvas.getContext('2d'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const engine = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng');
                m = reconstructMatrix(engine.data.words);
            } else {
                const ins = matrixA.querySelectorAll('input'); 
                const r = Number(rowsInput.value), col = Number(colsInput.value);
                m = []; for(let i=0; i<r; i++) {
                    let row = []; for(let j=0; j<col; j++) row.push(Number(ins[i*col + j].value)); m.push(row);
                }
            }
            patternReasoning.innerHTML = solveMatrixComplex(m, operationSelect.value);
            recommendedAnswer.innerHTML = "SELESAI";
            loadingState.classList.add('hidden'); dataState.classList.remove('hidden');
        } catch (e) { patternReasoning.textContent = e.message; loadingState.classList.add('hidden'); dataState.classList.remove('hidden'); }
    });

    function reconstructMatrix(words) {
        const numbers = words.filter(w => /^-?\d+([.,]\d+)?$/.test(w.text));
        if (numbers.length === 0) return null;
        const rows = [];
        numbers.forEach(num => {
            let found = false;
            for (let row of rows) {
                const avgY = row.reduce((sum, n) => sum + n.bbox.y0, 0) / row.length;
                if (Math.abs(num.bbox.y0 - avgY) < (num.bbox.y1 - num.bbox.y0) * 0.8) {
                    row.push(num); found = true; break;
                }
            }
            if (!found) rows.push([num]);
        });
        rows.sort((a,b)=>a[0].bbox.y0 - b[0].bbox.y0);
        return rows.map(r => { r.sort((a,b)=>a.bbox.x0 - b.bbox.x0); return r.map(n=>Number(n.text.replace(',','.'))); });
    }

    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(s=>{stream=s; video.srcObject=s;});
    closeResult.addEventListener('click', ()=>{resultPanel.classList.remove('show'); setTimeout(()=>resultPanel.classList.add('hidden'), 500);});
    btnScanTab.addEventListener('click', ()=>{currentMode='scan'; btnScanTab.classList.add('active'); btnManualTab.classList.remove('active'); document.getElementById('scan-view').classList.remove('hidden'); document.getElementById('manual-view').classList.add('hidden');});
    btnManualTab.addEventListener('click', ()=>{currentMode='manual'; btnScanTab.classList.remove('active'); btnManualTab.classList.add('active'); document.getElementById('scan-view').classList.add('hidden'); document.getElementById('manual-view').classList.remove('hidden'); createGrid(matrixA, rowsInput.value, colsInput.value);});

    createGrid(matrixA, 3, 3);
});
