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

    // --- GRID CORE FUNCTIONS ---
    function createGrid(container, r, c) {
        if (!container) return;
        container.innerHTML = '';
        container.style.display = 'grid';
        container.style.gridTemplateColumns = `repeat(${c}, 55px)`;
        container.style.justifyContent = 'center';
        container.style.gap = '8px';
        
        for(let i=0; i < r*c; i++) {
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'matrix-cell';
            input.value = '0';
            container.appendChild(input);
        }
    }

    function getMatrixFromGrid(container, r, c) {
        const inputs = container.querySelectorAll('input');
        if (inputs.length === 0) return null;
        const matrix = [];
        for(let i=0; i<r; i++) {
            const row = [];
            for(let j=0; j<c; j++) {
                const val = inputs[i*c + j].value;
                row.push(Number(val) || 0);
            }
            matrix.push(row);
        }
        return matrix;
    }

    // --- MODE SWITCHING ---
    function refreshGrids() {
        const r = parseInt(rowsInput.value), c = parseInt(colsInput.value);
        createGrid(matrixA, r, c);
        const op = operationSelect.value;
        if (['addition', 'multiplication'].includes(op)) {
            matrixBSection.classList.remove('hidden');
            createGrid(matrixB, r, c);
        } else {
            matrixBSection.classList.add('hidden');
        }
    }

    btnScanTab.addEventListener('click', () => {
        currentMode = 'scan';
        btnScanTab.classList.add('active');
        btnManualTab.classList.remove('active');
        scanView.classList.remove('hidden');
        manualView.classList.add('hidden');
    });

    btnManualTab.addEventListener('click', () => {
        currentMode = 'manual';
        btnScanTab.classList.remove('active');
        btnManualTab.classList.add('active');
        scanView.classList.add('hidden');
        manualView.classList.remove('hidden');
        refreshGrids();
    });

    updateGridBtn.addEventListener('click', refreshGrids);

    operationSelect.addEventListener('change', () => {
        const op = operationSelect.value;
        extraControls.classList.add('hidden'); plusMinusControl.classList.add('hidden'); powerControl.classList.add('hidden');
        if (op === 'addition') { extraControls.classList.remove('hidden'); plusMinusControl.classList.remove('hidden'); }
        else if (op === 'power') { extraControls.classList.remove('hidden'); powerControl.classList.remove('hidden'); }
        if (currentMode === 'manual') refreshGrids();
    });

    toggleOpBtn.addEventListener('click', () => {
        currentPlusMinus = (currentPlusMinus === '+') ? '-' : '+';
        toggleOpBtn.textContent = (currentPlusMinus === '+') ? '+ (Tambah)' : '- (Kurang)';
    });

    // --- MATH ENGINE ---
    function formatFraction(val) { if (Math.abs(val) < 1e-10) return "0"; try { const f = math.fraction(val); return f.d === 1 ? f.s * f.n : `${f.s === -1 ? '-' : ''}${f.n}/${f.d}`; } catch (e) { return val.toFixed(2); } }
    function formatMatrixHTML(m) { const raw = m.toArray ? m.toArray() : m; let h = '<div style="display:inline-block; border-left:2px solid #fff; border-right:2px solid #fff; padding:0 10px;">'; raw.forEach((row, i) => { h += '<div style="display:flex; justify-content:center; gap:12px; height:28px; align-items:center;">'; row.forEach((c, j) => { h += `<span style="color:${i===j?'#f1c40f':'#00d4ff'}; min-width:40px; text-align:center; font-size:0.75rem;">${formatFraction(c)}</span>`; }); h += '</div>'; }); return h + '</div>'; }

    // Smart Determinant Logic (Triangular)
    function solveMatrixSmart(matA, matB, op) {
        let A = JSON.parse(JSON.stringify(matA)), r = A.length, c = A[0].length, steps = "";
        function log(msg, m) { steps += `<div style="margin-bottom:15px; padding:10px; border-radius:10px; background:rgba(255,255,255,0.02);"><p style="font-size:0.6rem; color:var(--secondary); font-weight:800;">[ ${msg} ]</p>${formatMatrixHTML(m)}</div><div style="opacity:0.3; margin-bottom:10px;">↓</div>`; }

        if (op === 'determinant') {
            let swap = 0; log("MATRIKS AWAL", A);
            function diagCheck(m) { let u=true, l=true; for(let i=0; i<r; i++) for(let j=0; j<r; j++) { if(i>j && Math.abs(m[i][j])>1e-10) u=false; if(i<j && Math.abs(m[i][j])>1e-10) l=false; } return u||l; }
            if(!diagCheck(A)) {
                for(let j=0; j<c; j++) {
                    let mx=j; for(let i=j+1; i<r; i++) if(Math.abs(A[i][j])>Math.abs(A[mx][j])) mx=i;
                    if(Math.abs(A[mx][j])<1e-10) continue;
                    if(mx!==j) { [A[j],A[mx]]=[A[mx],A[j]]; swap++; log("TUKAR BARIS", A); }
                    for(let i=j+1; i<r; i++) { let f=A[i][j]/A[j][j]; A[i]=A[i].map((x,ix)=>x-f*A[j][ix]); }
                    log("ELIMINASI", A); if(diagCheck(A)) break;
                }
            }
            let dArr=[]; let dVal=Math.pow(-1, swap); for(let i=0; i<r; i++) { dArr.push(A[i][i]); dVal*=A[i][i]; }
            steps += `<div style="border-top:2px solid var(--primary); padding-top:20px;"><h2>Δ = ${formatFraction(dVal)}</h2><p style="font-size:0.7rem;">Formula: (-1)<sup>${swap}</sup> × (${dArr.map(v=>formatFraction(v)).join(" × ")})</p></div>`;
            return steps;
        } else if (op === 'inverse') {
            return steps + `<h3>RESULT (A⁻¹):</h3>` + formatMatrixHTML(math.inv(matA));
        } else if (op === 'transpose') {
            return steps + `<h3>RESULT (Aᵀ):</h3>` + formatMatrixHTML(math.transpose(matA));
        } else if (op === 'addition') {
            return steps + `<h3>RESULT (A ${currentPlusMinus} B):</h3>` + formatMatrixHTML((currentPlusMinus==='+')?math.add(matA,matB):math.subtract(matA,matB));
        } else if (op === 'multiplication') {
            return steps + `<h3>RESULT (A × B):</h3>` + formatMatrixHTML(math.multiply(matA,matB));
        } else if (op === 'power') {
            return steps + `<h3>RESULT (A<sup>${powerInput.value}</sup>):</h3>` + formatMatrixHTML(math.pow(matA, Number(powerInput.value)));
        } else if (op === 'rank') {
            return steps + `<h3>MATRIX RANK: ${math.rank(matA)}</h3>`;
        }
        return steps;
    }

    // --- CAPTURE / CALCULATE EVENT ---
    captureBtn.addEventListener('click', async () => {
        resultPanel.classList.remove('hidden');
        setTimeout(() => { resultPanel.classList.add('show'); document.querySelector('.panel-content').scrollTop = 0; }, 10);
        loadingState.classList.remove('hidden'); dataState.classList.add('hidden');

        try {
            let mA, mB = null;
            const r = parseInt(rowsInput.value), c = parseInt(colsInput.value);

            if (currentMode === 'manual') {
                mA = getMatrixFromGrid(matrixA, r, c);
                if (['addition', 'multiplication'].includes(operationSelect.value)) {
                    mB = getMatrixFromGrid(matrixB, r, c);
                }
            } else {
                const ctx = canvas.getContext('2d'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const eng = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng');
                mA = reconstructMatrix(eng.data.words);
            }

            if (!mA) throw new Error("Angka matriks tidak terbaca atau kosong.");
            detectedMatrixView.innerHTML = `Matrix A: ${formatMatrixHTML(mA)}`;
            patternReasoning.innerHTML = solveMatrixSmart(mA, mB, operationSelect.value);
            recommendedAnswer.innerHTML = "DONE";
            loadingState.classList.add('hidden'); dataState.classList.remove('hidden');
        } catch (e) { patternReasoning.textContent = e.message; loadingState.classList.add('hidden'); dataState.classList.remove('hidden'); }
    });

    function reconstructMatrix(words) { const numbers = words.filter(w => /^-?\d+([.,]\d+)?$/.test(w.text)); if (numbers.length === 0) return null; const rows = []; numbers.forEach(num => { let found = false; for (let row of rows) { const avgY = row.reduce((sum, n) => sum + n.bbox.y0, 0) / row.length; if (Math.abs(num.bbox.y0 - avgY) < (num.bbox.y1 - num.bbox.y0) * 0.8) { row.push(num); found = true; break; } } if (!found) rows.push([num]); }); rows.sort((a,b)=>a[0].bbox.y0-b[0].bbox.y0); return rows.map(r => { r.sort((a,b)=>a.bbox.x0 - b.bbox.x0); return r.map(n=>Number(n.text.replace(',','.'))); }); }
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(s=>{video.srcObject=s; stream=s;}).catch(e=>console.log("Stream off"));
    closeResult.addEventListener('click', ()=>{resultPanel.classList.remove('show'); setTimeout(()=>resultPanel.classList.add('hidden'), 500);});
    
    // Initial State
    createGrid(matrixA, 3, 3);
});
