document.addEventListener('DOMContentLoaded', () => {
    const btnScanTab = document.getElementById('btn-scan');
    const btnManualTab = document.getElementById('btn-manual');
    const scanView = document.getElementById('scan-view');
    const manualView = document.getElementById('manual-view');
    const btnText = document.getElementById('btn-text');
    const matrixA = document.getElementById('matrix-container');
    const matrixB = document.getElementById('matrix-container-b');
    const matrixBSection = document.getElementById('matrix-b-section');
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

    // --- UTILS ---
    function formatFraction(val) {
        if (Math.abs(val) < 1e-10) return "0";
        try {
            const f = math.fraction(val);
            return f.d === 1 ? f.s * f.n : `${f.s === -1 ? '-' : ''}${f.n}/${f.d}`;
        } catch (e) { return val.toFixed(2); }
    }

    function formatMatrixHTML(matrix, notes = [], augIdx = 0) {
        let rows = matrix.length, cols = matrix[0].length;
        let html = `<div style="width:100%; overflow-x:auto; margin:10px 0; padding-bottom:10px;">`;
        html += `<div style="display:inline-flex; align-items:center; min-width:100%; justify-content:center; gap:10px; padding:0 20px;">`;
        html += `<div style="border-left:2px solid #fff; border-right:2px solid #fff; padding:0 8px;">`;
        matrix.forEach((row, i) => {
            html += `<div style="display:flex; gap:12px; height:30px; align-items:center;">`;
            row.forEach((cell, j) => {
                if (augIdx > 0 && j === augIdx) {
                    html += `<div style="width:1px; height:20px; background:rgba(255,255,255,0.3); margin:0 5px;"></div>`;
                }
                html += `<span style="color:${i===j?'#f1c40f':'#00d4ff'}; min-width:42px; text-align:center; font-size:0.75rem;">${formatFraction(cell)}</span>`;
            });
            html += `</div>`;
        });
        html += `</div>`;
        html += `<div style="display:flex; flex-direction:column; justify-content:center; padding-left:10px;">`;
        matrix.forEach((_, i) => html += `<div style="height:30px; display:flex; align-items:center; color:#ff00c8; font-size:0.7rem; font-weight:700;">${notes[i] || ""}</div>`);
        html += `</div></div></div>`;
        return html;
    }

    // --- COMPLEX SOLVER ENGINE (ALL OPERATIONS) ---
    function solveAllOperations(originalMatrix, secondMatrix, op) {
        let A = JSON.parse(JSON.stringify(originalMatrix));
        let rows = A.length, cols = A[0].length;
        let stepsHTML = `<div style="padding-top:10px; text-align:center;">`;

        function logStep(msg, matrix, notes = [], aIdx = 0) {
            stepsHTML += `<div style="margin-bottom:20px; padding:10px; border-radius:12px; background:rgba(255,255,255,0.02);">`;
            stepsHTML += `<p style="font-size:0.6rem; color:var(--secondary); font-weight:800;">[ ${msg} ]</p>`;
            stepsHTML += formatMatrixHTML(matrix, notes, aIdx);
            stepsHTML += `</div><div style="margin-bottom:10px; opacity:0.3;">↓</div>`;
        }

        switch(op) {
            case 'determinant':
                let swapCount = 0; let detRes = 1; let diag = [];
                logStep("MATRIKS AWAL (REDUKSI SEGITIGA ATAS)", A);
                for (let j = 0; j < cols; j++) {
                    let maxR = j;
                    for(let i=j+1; i<rows; i++) if(Math.abs(A[i][j]) > Math.abs(A[maxR][j])) maxR = i;
                    if(Math.abs(A[maxR][j]) < 1e-10) continue;
                    if(maxR !== j) { [A[j], A[maxR]] = [A[maxR], A[j]]; swapCount++; logStep("TUKAR BARIS", A, {[j]:`R${j+1} ↔ R${maxR+1}`}); }
                    let ns = [];
                    for(let i=j+1; i<rows; i++) {
                        let f = A[i][j] / A[j][j];
                        if(Math.abs(f) > 1e-10) { A[i] = A[i].map((x,idx) => x - f * A[j][idx]); ns[i] = `R${i+1}-(${formatFraction(f)})R${j+1}`; }
                    }
                    if(ns.length > 0) logStep("ELIMINASI BAWAH", A, ns);
                }
                for(let i=0; i<rows; i++) diag.push(A[i][i]);
                let totalDet = Math.pow(-1, swapCount) * diag.reduce((p,v)=>p*v, 1);
                stepsHTML += `<div style="border:2px solid var(--primary); border-radius:15px; padding:15px;">`;
                stepsHTML += `<h2 style="margin-bottom:10px;">Δ = ${formatFraction(totalDet)}</h2>`;
                stepsHTML += `<p style="font-size:0.75rem;">Formula: (-1)<sup>${swapCount}</sup> × (${diag.map(v=>formatFraction(v)).join(" × ")})</p></div>`;
                break;

            case 'inverse':
                if(rows !== cols) throw new Error("Inverse hanya untuk matriks persegi.");
                for(let i=0; i<rows; i++) { for(let j=0; j<rows; j++) A[i].push(i===j? 1 : 0); }
                let augIdx = rows;
                logStep("AUGMENTED MATRIX [A | I]", A, [], augIdx);
                // FULL GAUSS-JORDAN
                let p = 0;
                for(let j=0; j<augIdx && p<rows; j++) {
                    let mx = p;
                    for(let i=p+1; i<rows; i++) if(Math.abs(A[i][j]) > Math.abs(A[mx][j])) mx=i;
                    if(Math.abs(A[mx][j]) < 1e-10) continue;
                    if(mx!==p) {[A[p],A[mx]]=[A[mx],A[p]]; logStep("SWAP", A, {[p]:`R${p+1}↔R${mx+1}`}, augIdx);}
                    let dv = A[p][j];
                    if(Math.abs(dv-1)>1e-10) {A[p]=A[p].map(x=>x/dv); logStep("NORMALISASI", A, {[p]:`R${p+1} / ${formatFraction(dv)}`}, augIdx);}
                    let ens = [];
                    for(let i=0; i<rows; i++) {
                        if(i!==p) {
                            let f = A[i][j];
                            if(Math.abs(f)>1e-10) {A[i]=A[i].map((x,idx)=>x-f*A[p][idx]); ens[i]=`R${i+1}-(${formatFraction(f)})R${p+1}`;}
                        }
                    }
                    if(ens.length>0) logStep("ELIMINASI", A, ens, augIdx);
                    p++;
                }
                let inv = A.map(r=>r.slice(augIdx));
                stepsHTML += `<h3>MATRIX INVERSE (A⁻¹):</h3>` + formatMatrixHTML(inv);
                break;

            case 'transpose':
                let trans = [];
                for(let j=0; j<cols; j++) { let row = []; for(let i=0; i<rows; i++) row.push(A[i][j]); trans.push(row); }
                stepsHTML += `<h3>TRANSPOSE (Aᵀ):</h3>` + formatMatrixHTML(trans);
                break;

            case 'rank':
                let rank = 0;
                // Simple Row Echelon for Rank
                for(let j=0; j<cols && rank<rows; j++) {
                    let mx=rank;
                    for(let i=rank+1; i<rows; i++) if(Math.abs(A[i][j])>Math.abs(A[mx][j])) mx=i;
                    if(Math.abs(A[mx][j])<1e-10) continue;
                    [A[rank],A[mx]]=[A[mx],A[rank]];
                    for(let i=rank+1; i<rows; i++) {
                        let f = A[i][j]/A[rank][j];
                        A[i] = A[i].map((x,idx)=>x-f*A[rank][idx]);
                    }
                    rank++;
                }
                stepsHTML += `<div style="font-size:2rem; font-weight:800;">Rank = ${rank}</div>`;
                break;

            case 'addition':
                if(!secondMatrix) throw new Error("Pilih menu MANUAL untuk penambahan.");
                let addRes = A.map((r,i)=>r.map((c,j)=>c + secondMatrix[i][j]));
                stepsHTML += `<h3>RESULT (A + B):</h3>` + formatMatrixHTML(addRes);
                break;

            default:
                stepsHTML += `<p>Gunakan Operasi Lain (Det/Inv/Rank/Transpose).</p>`;
        }
        return stepsHTML + `</div>`;
    }

    // --- UI LOGIC ---
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
            let m; let mB = null;
            if (currentMode === 'scan') {
                const ctx = canvas.getContext('2d'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const engine = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng');
                m = reconstructMatrix(engine.data.words);
            } else {
                const r = Number(rowsInput.value), col = Number(colsInput.value);
                const insA = matrixA.querySelectorAll('input');
                m = []; for(let i=0; i<r; i++) { let row = []; for(let j=0; j<col; j++) row.push(Number(insA[i*col+j].value)); m.push(row); }
                const insB = matrixB.querySelectorAll('input');
                if(insB.length > 0) {
                    mB = []; for(let i=0; i<r; i++) { let row = []; for(let j=0; j<col; j++) row.push(Number(insB[i*col+j].value)); mB.push(row); }
                }
            }
            if (!m) throw new Error("Gagal membaca matriks.");
            patternReasoning.innerHTML = solveAllOperations(m, mB, operationSelect.value);
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
