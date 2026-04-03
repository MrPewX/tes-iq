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
    const detectedMatrixView = document.getElementById('detected-matrix-view');
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

    function formatMatrixHTML(matrix, notes = [], isAugmented = false, splitIndex = 0) {
        // Wrapper for horizontal scroll!
        let html = `<div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; margin:10px 0; padding-bottom:10px;">`;
        html += `<div style="display:inline-flex; align-items:center; min-width:100%; justify-content:center; gap:15px; padding:0 20px;">`;
        
        // Matrix Body
        html += `<div style="border-left:2px solid #fff; border-right:2px solid #fff; padding:0 10px; display:inline-block;">`;
        matrix.forEach((row, i) => {
            html += `<div style="display:flex; gap:12px; height:30px; align-items:center; white-space:nowrap;">`;
            row.forEach((cell, cellIdx) => {
                if (isAugmented && cellIdx === splitIndex) {
                    html += `<div style="width:1px; height:100%; background:rgba(255,255,255,0.3); margin:0 5px;"></div>`;
                }
                html += `<span style="color:#00d4ff; min-width:45px; text-align:center; font-size:0.8rem;">${formatFraction(cell)}</span>`;
            });
            html += `</div>`;
        });
        html += `</div>`;

        // OBE Notes Aligned
        html += `<div style="display:flex; flex-direction:column; justify-content:center;">`;
        matrix.forEach((_, i) => {
            const note = notes[i] || "";
            html += `<div style="height:30px; display:flex; align-items:center; color:#ff00c8; font-size:0.75rem; font-weight:700; white-space:nowrap;">${note}</div>`;
        });
        html += `</div></div></div>`;
        return html;
    }

    // --- OBE ENGINE WITH FORMULA LOGGING ---
    function solveMatrixComplex(originalMatrix, op) {
        let A = JSON.parse(JSON.stringify(originalMatrix));
        let r = A.length, c = A[0].length;
        let stepsHTML = `<div style="padding-top:10px; text-align:center;">`;
        let detFactors = []; // Track factors for Δ formula
        let isInverse = (op === 'inverse');
        let splitIdx = c;

        if (isInverse) {
            for(let i=0; i<r; i++) {
                for(let j=0; j<r; j++) A[i].push(i===j ? 1 : 0);
            }
            c = A[0].length;
        }

        function logStep(msg, matrix, notes) {
            stepsHTML += `<div style="border-bottom:1px solid #222; margin-bottom:20px; padding:10px 0;">`;
            stepsHTML += `<p style="font-size:0.6rem; color:var(--secondary); text-transform:uppercase; font-weight:800;">[ ${msg} ]</p>`;
            stepsHTML += formatMatrixHTML(matrix, notes, isInverse, splitIdx);
            stepsHTML += `</div>`;
        }

        logStep("MATRIKS AWAL", A, []);

        let pivotCount = 0;
        for (let j = 0; j < (isInverse ? splitIdx : c) && pivotCount < r; j++) {
            let maxRow = pivotCount;
            for (let i = pivotCount + 1; i < r; i++) {
                if (Math.abs(A[i][j]) > Math.abs(A[maxRow][j])) maxRow = i;
            }
            if (Math.abs(A[maxRow][j]) < 1e-10) continue;

            if (maxRow !== pivotCount) {
                [A[pivotCount], A[maxRow]] = [A[maxRow], A[pivotCount]];
                detFactors.push(-1); // Swap multiplier
                logStep("TUKAR BARIS", A, { [pivotCount]: `R${pivotCount+1} ↔ R${maxRow+1}` });
            }

            let divisor = A[pivotCount][j];
            if (Math.abs(divisor - 1) > 1e-10) {
                detFactors.push(divisor); // Normalization multiplier
                A[pivotCount] = A[pivotCount].map(x => x / divisor);
                logStep("NORMALISASI", A, { [pivotCount]: `R${pivotCount+1} ÷ (${formatFraction(divisor)})` });
            }

            let elimNotes = [];
            for (let i = 0; i < r; i++) {
                if (i !== pivotCount) {
                    let factor = A[i][j];
                    if (Math.abs(factor) > 1e-10) {
                        A[i] = A[i].map((x, idx) => x - factor * A[pivotCount][idx]);
                        elimNotes[i] = `R${i+1} - (${formatFraction(factor)})R${pivotCount+1}`;
                    }
                }
            }
            logStep("ELIMINASI KOLOM", A, elimNotes);
            pivotCount++;
        }

        // Result Logic
        let resSum = `<div style="margin-top:40px; border-top:2px solid var(--primary); padding-top:25px;">`;
        resSum += `<h2 style="color:#fff; letter-spacing:2px; font-weight:800;">HASIL AKHIR</h2>`;

        if (op === 'determinant') {
            if (pivotCount < r) {
                resSum += `<div style="font-size:1.5rem;">Δ = 0</div><p style="font-size:0.7rem; color:var(--text-dim)">(Bukan Matrix Full Rank)</p>`;
            } else {
                let formulaStr = detFactors.map(f => `(${formatFraction(f)})`).join(" × ");
                let totalDet = detFactors.reduce((p, c) => p * c, 1);
                resSum += `<div style="font-size:1rem; color:var(--text-dim); margin-bottom:10px;">Δ = ${formulaStr}</div>`;
                resSum += `<div style="font-size:2.5rem; font-weight:800; color:var(--secondary);">Δ = ${formatFraction(totalDet)}</div>`;
            }
        } else if (op === 'inverse') {
            const det = detFactors.reduce((p,c)=>p*c, 1);
            if (Math.abs(det) < 1e-10) {
                resSum += `<h3 style="color:red;">Tidak Ada Invers (Det=0)</h3>`;
            } else {
                let inv = A.map(row => row.slice(splitIdx));
                resSum += `<div style="font-size:0.8rem; margin:10px 0;">Matriks Invers (A⁻¹):</div>`;
                resSum += formatMatrixHTML(inv);
            }
        }
        return stepsHTML + resSum + `</div>`;
    }

    // --- UI ACTIONS ---
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
                const r = rowsInput.value, c = colsInput.value;
                m = []; for(let i=0; i<r; i++) {
                    const row = []; for(let j=0; j<c; j++) row.push(Number(ins[i*c + j].value));
                    m.push(row);
                }
            }
            if (!m) throw new Error("Gagal membaca matriks.");
            
            patternReasoning.innerHTML = solveMatrixComplex(m, operationSelect.value);
            recommendedAnswer.innerHTML = "SELESAI";
            loadingState.classList.add('hidden'); dataState.classList.remove('hidden');
        } catch (e) {
            recommendedAnswer.textContent = "Error"; patternReasoning.textContent = e.message;
            loadingState.classList.add('hidden'); dataState.classList.remove('hidden');
        }
    });

    function createGrid(container, r, c) {
        container.innerHTML = ''; container.style.gridTemplateColumns = `repeat(${c}, 50px)`;
        for(let i=0; i < r*c; i++) {
            const input = document.createElement('input'); input.type = 'number';
            input.className = 'matrix-cell'; input.value = '0'; container.appendChild(input);
        }
    }

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

    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(s=>{video.srcObject=s; stream=s;});
    closeResult.addEventListener('click', ()=>{resultPanel.classList.remove('show'); setTimeout(()=>resultPanel.classList.add('hidden'), 500);});
    btnScanTab.addEventListener('click', ()=>{currentMode='scan'; btnScanTab.classList.add('active'); btnManualTab.classList.remove('active'); document.getElementById('scan-view').classList.remove('hidden'); document.getElementById('manual-view').classList.add('hidden'); btnText.textContent="SCAN & SOLVE";});
    btnManualTab.addEventListener('click', ()=>{currentMode='manual'; btnScanTab.classList.remove('active'); btnManualTab.classList.add('active'); document.getElementById('scan-view').classList.add('hidden'); document.getElementById('manual-view').classList.remove('hidden'); btnText.textContent="CALCULATE MANUAL"; createGrid(matrixA, rowsInput.value, colsInput.value);});
    createGrid(matrixA, 3, 3);
});
