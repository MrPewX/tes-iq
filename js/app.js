document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
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
    const detectedMatrixView = document.getElementById('detected-matrix-view');
    const loadingState = document.querySelector('.loading-state');
    const dataState = document.querySelector('.data-state');

    let currentMode = 'scan';
    let stream = null;

    // --- TAB SWITCHING ---
    btnScanTab.addEventListener('click', () => {
        currentMode = 'scan';
        btnScanTab.classList.add('active');
        btnManualTab.classList.remove('active');
        scanView.classList.remove('hidden');
        manualView.classList.add('hidden');
        btnText.textContent = "SCAN & SOLVE";
    });

    btnManualTab.addEventListener('click', () => {
        currentMode = 'manual';
        btnScanTab.classList.remove('active');
        btnManualTab.classList.add('active');
        scanView.classList.add('hidden');
        manualView.classList.remove('hidden');
        btnText.textContent = "CALCULATE MANUAL";
        createGrid(matrixA, rowsInput.value, colsInput.value);
    });

    // --- MATH UTILS ---
    function formatFraction(val) {
        if (Math.abs(val) < 1e-10) return "0";
        try {
            const f = math.fraction(val);
            return f.d === 1 ? f.s * f.n : `${f.s === -1 ? '-' : ''}${f.n}/${f.d}`;
        } catch (e) {
            return val.toFixed(2);
        }
    }

    function formatMatrixHTMLForOBE(matrix, notes = [], isAugmented = false, splitIndex = 0) {
        let html = `<div style="display:flex; align-items:center; justify-content:center; gap:10px; margin:15px 0;">`;
        
        // Matrix Part
        html += `<div style="border-left:2px solid #fff; border-right:2px solid #fff; padding:0 8px;">`;
        matrix.forEach((row, i) => {
            html += `<div style="display:flex; gap:12px; height:28px; align-items:center;">`;
            row.forEach((cell, cellIdx) => {
                // Add vertical line if combined matrix
                if (isAugmented && cellIdx === splitIndex) {
                    html += `<div style="width:1px; height:100%; background:rgba(255,255,255,0.2); margin:0 5px;"></div>`;
                }
                html += `<span style="color:#00d4ff; width:42px; text-align:center; font-size:0.75rem;">${formatFraction(cell)}</span>`;
            });
            html += `</div>`;
        });
        html += `</div>`;

        // OBE Notes Part
        html += `<div style="display:flex; flex-direction:column; justify-content:center; gap:0;">`;
        matrix.forEach((_, i) => {
            const note = notes[i] || "";
            html += `<div style="height:28px; display:flex; align-items:center; color:#ff00c8; font-size:0.7rem; font-weight:700; white-space:nowrap; padding-left:10px;">${note}</div>`;
        });
        html += `</div></div>`;
        return html;
    }

    // --- ADVANCED OBE ENGINE ---
    function solveMatrixComplex(originalMatrix, op) {
        let A = JSON.parse(JSON.stringify(originalMatrix));
        let r = A.length, c = A[0].length;
        let stepsHTML = `<div style="padding-top:10px; text-align:center;">`;
        let detMultiplier = 1;
        let isInverse = (op === 'inverse');
        let splitIdx = c;

        // Augment for Inverse
        if (isInverse) {
            if (r !== c) throw new Error("Inverse hanya untuk matriks persegi.");
            for(let i=0; i<r; i++) {
                for(let j=0; j<r; j++) A[i].push(i===j ? 1 : 0);
            }
            c = A[0].length;
        }

        function logStep(msg, matrix, notes) {
            stepsHTML += `<div style="border-bottom:1px solid #222; margin-bottom:15px; background:rgba(255,255,255,0.02); border-radius:10px; padding:10px 0;">`;
            stepsHTML += `<p style="font-size:0.65rem; color:var(--secondary); font-weight:700;">[ ${msg} ]</p>`;
            stepsHTML += formatMatrixHTMLForOBE(matrix, notes, isInverse, splitIdx);
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
                detMultiplier *= -1;
                let notes = [];
                notes[pivotCount] = `R${pivotCount+1} ↔ R${maxRow+1} (det ×-1)`;
                logStep("TUKAR BARIS", A, notes);
            }

            let divisor = A[pivotCount][j];
            if (Math.abs(divisor - 1) > 1e-10) {
                A[pivotCount] = A[pivotCount].map(x => x / divisor);
                detMultiplier *= divisor;
                let notes = [];
                notes[pivotCount] = `R${pivotCount+1} = R${pivotCount+1} ÷ (${formatFraction(divisor)})`;
                logStep("NORMALISASI BARIS", A, notes);
            }

            let elimNotes = [];
            let changed = false;
            for (let i = 0; i < r; i++) {
                if (i !== pivotCount) {
                    let factor = A[i][j];
                    if (Math.abs(factor) > 1e-10) {
                        A[i] = A[i].map((x, idx) => x - factor * A[pivotCount][idx]);
                        elimNotes[i] = `R${i+1} - (${formatFraction(factor)})R${pivotCount+1}`;
                        changed = true;
                    }
                }
            }
            if (changed) logStep("ELIMINASI KOLOM", A, elimNotes);
            pivotCount++;
        }

        // Final result calculation
        let finalDet = (pivotCount < r && !isInverse) ? 0 : detMultiplier;
        
        let resultSection = `<div class="result-summary" style="margin-top:30px; border-top:2px solid var(--secondary); padding-top:20px;">`;
        resultSection += `<h2 style="color:var(--secondary); margin-bottom:15px;">FINAL RESULT</h2>`;
        
        if (op === 'determinant') {
            resultSection += `<div style="font-size:2rem; font-weight:800;">Δ = ${formatFraction(finalDet)}</div>`;
            resultSection += `<p style="font-size:0.7rem; color:var(--text-dim)">(Berdasarkan perkalian pivot & faktor operasi baris)</p>`;
        } else if (op === 'inverse') {
            if (Math.abs(finalDet) < 1e-10) {
                resultSection += `<h3 style="color:red;">Tidak Memiliki Invers (Det=0)</h3>`;
            } else {
                let invMatrix = A.map(row => row.slice(splitIdx));
                resultSection += `<div style="font-size:0.8rem; margin-bottom:5px;">A<sup>-1</sup> =</div>`;
                resultSection += formatMatrixHTMLForOBE(invMatrix, []);
            }
        } else {
            resultSection += `<div style="font-size:0.8rem;">Eselon Baris Tereduksi =</div>`;
            resultSection += formatMatrixHTMLForOBE(A, []);
        }
        resultSection += `</div>`;

        return stepsHTML + resultSection;
    }

    // --- APP LOGIC ---
    captureBtn.addEventListener('click', async () => {
        resultPanel.classList.remove('hidden');
        setTimeout(() => {
            resultPanel.classList.add('show');
            document.querySelector('.panel-content').scrollTop = 0;
        }, 10);
        loadingState.classList.remove('hidden');
        dataState.classList.add('hidden');

        try {
            let matrix = null;
            if (currentMode === 'scan') {
                const context = canvas.getContext('2d');
                canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                // Pre-process context... (Skipped for brevity but same as before)
                const engine = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng');
                matrix = reconstructMatrix(engine.data.words);
            } else {
                const ins = matrixA.querySelectorAll('input');
                const r = rowsInput.value, c = colsInput.value;
                matrix = [];
                for(let i=0; i<r; i++) {
                    const row = [];
                    for(let j=0; j<c; j++) row.push(Number(ins[i*c + j].value));
                    matrix.push(row);
                }
            }

            if (!matrix) throw new Error("Gagal membaca matriks.");
            
            const finalView = solveMatrixComplex(matrix, operationSelect.value);
            recommendedAnswer.innerHTML = "BERHASIL"; // Diganti di summary bawah
            patternReasoning.innerHTML = finalView;

            loadingState.classList.add('hidden');
            dataState.classList.remove('hidden');
        } catch (err) {
            recommendedAnswer.textContent = "Error";
            patternReasoning.textContent = err.message;
            loadingState.classList.add('hidden');
            dataState.classList.remove('hidden');
        }
    });

    function createGrid(container, r, c) {
        container.innerHTML = ''; container.style.gridTemplateColumns = `repeat(${c}, 50px)`;
        for(let i=0; i < r*c; i++) {
            const input = document.createElement('input');
            input.type = 'number'; input.className = 'matrix-cell';
            input.value = '0'; container.appendChild(input);
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
        rows.sort((a,b) => a[0].bbox.y0 - b[0].bbox.y0);
        return rows.map(r => {
            r.sort((a,b) => a.bbox.x0 - b.bbox.x0);
            return r.map(n => Number(n.text.replace(',','.')));
        });
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => { stream = s; video.srcObject = s; });

    closeResult.addEventListener('click', () => {
        resultPanel.classList.remove('show');
        setTimeout(() => resultPanel.classList.add('hidden'), 500);
    });

    createGrid(matrixA, 3, 3);
});
