
        let validImages = [];
        let currentPage = 0;
        const imagesPerPage = 100;
        let selectedCollege = "AU"; 
        let activePrefixSearchId = 0;
        let activeNameFetches = 0;
        const nameFetchQueue = [];
        const pendingNameRequests = new Map();
        const imageExistenceCache = new Map();
        const MAX_NAME_FETCH_CONCURRENCY = 8;
        const INITIAL_RENDER_THRESHOLD = 80;
        const NAME_CACHE_KEY = "student_name_cache_v2";
        const NAME_CACHE_MAX_ENTRIES = 3000;
        const NAME_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 60; // 60 days
        const runtimeNameCache = new Map();
        const nameCacheStore = loadNameCacheStore();
        const cloudNameLookupCache = new Map();
        const pendingCloudUpserts = new Map();

        const CLOUD_DB_CONFIG = {
            apiKey: "AIzaSyDuVC2xdJF-Z6fcDeSgbrgj-1N0p0vYNDo",
            authDomain: "studentphotos-98756.firebaseapp.com",
            projectId: "studentphotos-98756",
            storageBucket: "studentphotos-98756.firebasestorage.app",
            messagingSenderId: "692063226998",
            appId: "1:692063226998:web:cb7e184895259b0a5be357",
            measurementId: "G-56GYDHNWE5"
        };

        const isCloudDbConfigured = Object.values(CLOUD_DB_CONFIG).every((value) => typeof value === "string" && value.trim() !== "");

        const cloudDb = (() => {
            if (!isCloudDbConfigured || !window.firebase) return null;
            try {
                const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(CLOUD_DB_CONFIG);
                return firebase.firestore(app);
            } catch (error) {
                console.warn("Cloud name database disabled:", error);
                return null;
            }
        })();
        // Enables or disables the generate button based on the checkbox state
function toggleGenerateButton() {
    const checkbox = document.getElementById("termsAgreement");
    const btn = document.getElementById("generateBtn");
    
    if (checkbox.checked) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
    } else {
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
    }
}

// Smooth scroll to the bottom of the page
function scrollToBottom() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}
        function isValidCachedName(name) {
            return name && name !== "Not found" && name !== "Not Found" && name !== "Error";
        }

        function isStudentRollCacheKey(key) {
            return /^\d{2}[A-Z0-9]{8,10}$/.test(key);
        }

        function normalizeCollegeForRoll(roll, college = selectedCollege) {
            if (college === "AU" || roll.includes("B11") || roll.includes("M11") || roll.includes("M12") || roll.includes("B12")) {
                return "AU";
            }
            if (college === "AEC" || roll.substring(2, 4) === "A9") {
                return "AEC";
            }
            return "ACET";
        }

        function getNameCacheKey(roll, college = selectedCollege) {
            return `${normalizeCollegeForRoll(roll, college)}:${roll}`;
        }

        function sanitizeDbKey(value, fallback = "UNKNOWN") {
            const clean = String(value || "").trim().toUpperCase();
            if (!clean) return fallback;
            const sanitized = clean.replace(/[^A-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
            return sanitized || fallback;
        }

        function toggleInlineLoader(show) {
    let loader = document.getElementById("inline-fetch-loader");
    const container = document.getElementById("photoContainer");
    
    if (!loader) {
        loader = document.createElement("div");
        loader.id = "inline-fetch-loader";
        loader.className = "dot-loader";
        loader.style.cssText = "width: 100%; display: flex; justify-content: center; padding: 40px 0; grid-column: 1 / -1;";
        loader.innerHTML = `<span></span><span></span><span></span>`;
    }

    if (show && container) {
        container.appendChild(loader); // Puts loader at the very end of the photo grid
        loader.style.display = "flex";
    } else if (loader) {
        loader.remove(); // Completely removes it when done
    }
}

        function deriveBranchFromRoll(roll, college = selectedCollege) {
            const normalizedCollege = normalizeCollegeForRoll(roll, college);
            if (normalizedCollege === "AU") {
                return auBranchMap?.[roll.slice(5, 7)] || roll.slice(5, 7) || "UNKNOWN";
            }
            return branchMap?.[roll.slice(6, 8)] || roll.slice(6, 8) || "UNKNOWN";
        }

        function getCloudStudentDocRef(roll, college = selectedCollege) {
            if (!cloudDb) return null;
            const normalizedCollege = normalizeCollegeForRoll(roll, college);
            const branchLabel = deriveBranchFromRoll(roll, college);
            const branchKey = sanitizeDbKey(branchLabel);
            const yearKey = sanitizeDbKey(roll.slice(0, 2));

            return {
                docRef: cloudDb
                    .collection("colleges")
                    .doc(normalizedCollege)
                    .collection("branches")
                    .doc(branchKey)
                    .collection("years")
                    .doc(yearKey)
                    .collection("students")
                    .doc(roll),
                metadata: {
                    college: normalizedCollege,
                    branch: branchLabel,
                    branchKey,
                    year: roll.slice(0, 2),
                    isLateralEntry: checkIsLE(roll)
                }
            };
        }

        async function getNameFromCloudDb(roll, college = selectedCollege) {
            if (!cloudDb) return null;
            const cacheKey = getNameCacheKey(roll, college);
            if (cloudNameLookupCache.has(cacheKey)) {
                return cloudNameLookupCache.get(cacheKey);
            }

            const cloudEntry = getCloudStudentDocRef(roll, college);
            if (!cloudEntry) return null;

            try {
                const snapshot = await cloudEntry.docRef.get();
                const name = snapshot.exists ? snapshot.data()?.name : null;
                const resolved = isValidCachedName(name) ? name : null;
                cloudNameLookupCache.set(cacheKey, resolved);
                if (resolved) setCachedName(roll, resolved, college);
                return resolved;
            } catch (error) {
                console.warn(`Cloud DB lookup failed for ${roll}:`, error);
                return null;
            }
        }

        async function upsertNameInCloudDb(roll, name, college = selectedCollege) {
            if (!cloudDb || !isValidCachedName(name)) return;

            const cacheKey = getNameCacheKey(roll, college);
            if (pendingCloudUpserts.has(cacheKey)) {
                return pendingCloudUpserts.get(cacheKey);
            }

            const cloudEntry = getCloudStudentDocRef(roll, college);
            if (!cloudEntry) return;

            const writePromise = (async () => {
                try {
                    const { docRef, metadata } = cloudEntry;
                    const existing = await docRef.get();
                    const existingName = existing.exists ? existing.data()?.name : null;

                    if (existing.exists && existingName === name) {
                        cloudNameLookupCache.set(cacheKey, name);
                        return;
                    }

                    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
                    const payload = {
                        roll,
                        name,
                        college: metadata.college,
                        branch: metadata.branch,
                        year: metadata.year,
                        isLateralEntry: metadata.isLateralEntry,
                        entryType: metadata.isLateralEntry ? "LATERAL_ENTRY" : "REGULAR",
                        updatedAt: serverTimestamp
                    };

                    if (!existing.exists) {
                        payload.createdAt = serverTimestamp;
                    }

                    await docRef.set(payload, { merge: true });
                    cloudNameLookupCache.set(cacheKey, name);
                } catch (error) {
                    console.warn(`Cloud DB upsert failed for ${roll}:`, error);
                } finally {
                    pendingCloudUpserts.delete(cacheKey);
                }
            })();

            pendingCloudUpserts.set(cacheKey, writePromise);
            return writePromise;
        }

        function loadNameCacheStore() {
            try {
                const raw = localStorage.getItem(NAME_CACHE_KEY);
                if (!raw) return {};
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === "object" ? parsed : {};
            } catch {
                return {};
            }
        }

        function persistNameCacheStore() {
            try {
                localStorage.setItem(NAME_CACHE_KEY, JSON.stringify(nameCacheStore));
            } catch (error) {
                console.warn("Could not persist name cache:", error);
            }
        }

        function pruneNameCacheStore() {
            const now = Date.now();
            const entries = Object.entries(nameCacheStore).filter(([, value]) =>
                value && isValidCachedName(value.name) && now - (value.savedAt || 0) <= NAME_CACHE_TTL_MS
            );

            entries.sort((a, b) => (b[1].lastAccess || b[1].savedAt || 0) - (a[1].lastAccess || a[1].savedAt || 0));
            const trimmed = entries.slice(0, NAME_CACHE_MAX_ENTRIES);

            Object.keys(nameCacheStore).forEach((key) => delete nameCacheStore[key]);
            trimmed.forEach(([key, value]) => { nameCacheStore[key] = value; });
        }

        function getCachedName(roll, college = selectedCollege) {
            const cacheKey = getNameCacheKey(roll, college);
            const runtimeCached = runtimeNameCache.get(cacheKey);
            if (isValidCachedName(runtimeCached)) {
                return runtimeCached;
            }

            const entry = nameCacheStore[cacheKey];
            if (!entry || !isValidCachedName(entry.name)) return null;

            if (Date.now() - (entry.savedAt || 0) > NAME_CACHE_TTL_MS) {
                delete nameCacheStore[cacheKey];
                persistNameCacheStore();
                return null;
            }

            entry.lastAccess = Date.now();
            runtimeNameCache.set(cacheKey, entry.name);
            return entry.name;
        }
        
        function setCachedName(roll, name, college = selectedCollege) {
            if (!isValidCachedName(name)) return;

            const cacheKey = getNameCacheKey(roll, college);
            const now = Date.now();
            runtimeNameCache.set(cacheKey, name);
            nameCacheStore[cacheKey] = { name, savedAt: now, lastAccess: now };
            pruneNameCacheStore();
            persistNameCacheStore();
        }

        function requestNameFromApi(roll, college = selectedCollege) {
            return fetch("https://student-name-api.onrender.com/get_name", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: "roll_number=" + encodeURIComponent(roll) + "&college=" + encodeURIComponent(college)
            })
            .then(res => res.json());
        }

        async function resolveNameWithRetry(roll, college = selectedCollege, retries = 1) {
            const cloudName = await getNameFromCloudDb(roll, college);
            if (isValidCachedName(cloudName)) {
                return cloudName;
            }

            let hadNetworkError = false;
            for (let attempt = 0; attempt <= retries; attempt++) {
                try {
                    const data = await requestNameFromApi(roll, college);
                    const name = data?.name;
                    if (isValidCachedName(name)) {
                        setCachedName(roll, name, college);
                        upsertNameInCloudDb(roll, name, college);
                        return name;
                    }
                } catch (error) {
                    hadNetworkError = true;
                    console.error(`Error fetching name for ${roll}:`, error);
                }
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 600));
                }
            }
            return hadNetworkError ? "Error" : "Not found";
        }

        function pumpNameQueue() {
            while (activeNameFetches < MAX_NAME_FETCH_CONCURRENCY && nameFetchQueue.length > 0) {
                const nextTask = nameFetchQueue.shift();
                activeNameFetches++;
                resolveNameWithRetry(nextTask.roll, nextTask.college, nextTask.retries)
                    .then(nextTask.resolve)
                    .finally(() => {
                        activeNameFetches--;
                        pumpNameQueue();
                    });
            }
        }

        function queueNameLookup(roll, college = selectedCollege, retries = 1) {
            const requestKey = `${normalizeCollegeForRoll(roll, college)}:${roll}`;
            if (pendingNameRequests.has(requestKey)) {
                return pendingNameRequests.get(requestKey);
            }

            const queued = new Promise((resolve) => {
                nameFetchQueue.push({ roll, college, retries, resolve });
                pumpNameQueue();
            });

            pendingNameRequests.set(requestKey, queued);
            queued.finally(() => pendingNameRequests.delete(requestKey));
            return queued;
        }

        function fetchNameWithRetry(roll, nameEl, retries = 1, college = selectedCollege, isSecondAttempt = false) {
    const cachedName = getCachedName(roll, college);
    if (isValidCachedName(cachedName)) {
        nameEl.innerText = cachedName;
        // Quietly sync the locally cached name to the Cloud DB in the background!
        upsertNameInCloudDb(roll, cachedName, college);
        return;
    }

    queueNameLookup(roll, college, retries).then((resolvedName) => {
        if (!nameEl || !nameEl.isConnected) return;
        
        // 1. THE RETRY TRIGGER: If it fails and we haven't retried yet...
        if ((resolvedName === "Not found" || resolvedName === "Error") && !isSecondAttempt) {
            // Show a sleek mini-loader text so the user knows it's fixing itself
            nameEl.innerHTML = `<span style="color: #f97316; font-size: 13px; font-weight: bold;">Retrying...</span>`;
            
            // Wait 1.5 seconds (gives the server a moment to recover), then try ONE more time
            setTimeout(() => {
                fetchNameWithRetry(roll, nameEl, retries, college, true);
            }, 1500);
            return;
        }

        // 2. THE FINAL RESULT: If it still fails, color it red. Otherwise, show the name!
        if (resolvedName === "Not found" || resolvedName === "Error") {
            nameEl.innerHTML = `<span style="color: #ef4444; font-size: 13px;">${resolvedName}</span>`;
        } else {
            nameEl.innerText = resolvedName;
        }
    });
}

        function selectCollege(college, event) {
            selectedCollege = college;
            document.querySelectorAll(".college-btn").forEach(btn => btn.classList.remove("active"));
            if (event && event.target) {
                event.target.classList.add("active");
            }
        }

        function getPhotoUrl(roll) {
            const cacheBuster = "?v=2"; // Bypasses previously cached 404 errors
            if (selectedCollege === "AU") {
                return `https://info.aec.edu.in/aus/StudentPhotos_Original/${roll}.jpg${cacheBuster}`;
            } else if (selectedCollege === "AEC" || roll.substring(2, 4) === "A9") {
                return `https://info.aec.edu.in/AEC/studentPhotos/${roll}.jpg${cacheBuster}`;
            } else {
                return `https://info.aec.edu.in/acet/studentPhotos/${roll}.jpg${cacheBuster}`;
            }
        }
        function checkImageExists(url) {
            if (imageExistenceCache.has(url)) {
                return imageExistenceCache.get(url);
            }

            const checkPromise = new Promise((resolve) => {
                const img = new Image();
                img.decoding = "async";
                img.src = url;
                img.onload = () => resolve(url);
                img.onerror = () => resolve(null);
            });

            imageExistenceCache.set(url, checkPromise);
            return checkPromise;
        }
        function setGenerationLoading(isLoading) {
            const loader = document.getElementById("loader");
            const overlay = document.getElementById("loader-overlay");
            const generateBtn = document.getElementById("generateBtn");
            loader.style.display = isLoading ? "flex" : "none";
            overlay.style.display = isLoading ? "block" : "none";
            generateBtn.disabled = isLoading;
            generateBtn.style.opacity = isLoading ? "0.75" : "1";
            generateBtn.textContent = isLoading ? "Generating..." : "Generate Photos";
        }

        function updateResultSummary(total, query, mode = "results") {
            const summary = document.getElementById("resultSummary");
            summary.textContent = `${total} ${mode} found for "${query}" in ${selectedCollege}`;
            summary.style.display = "block";
        }

        function clearResultSummary() {
            const summary = document.getElementById("resultSummary");
            summary.style.display = "none";
            summary.textContent = "";
        }

        function appendLeBanner(fragment) {
            const leBanner = document.createElement("div");
            leBanner.className = "branch-banner";
            leBanner.textContent = "LE's";
            leBanner.style.display = "block";
            leBanner.style.margin = "8px 0 4px 0";

            const leWrapper = document.createElement("div");
            leWrapper.style.width = "100%";
            leWrapper.style.display = "flex";
            leWrapper.style.justifyContent = "center";
            leWrapper.appendChild(leBanner);
            fragment.appendChild(leWrapper);
        }

        function handlePhotoLoad(photo) {
            const shell = photo.closest(".photo-shell");
            if (!shell) return;
            shell.classList.remove("is-loading");
            const loaderEl = shell.querySelector(".photo-loader");
            if (loaderEl) loaderEl.remove();
            photo.style.opacity = "1";
        }

        function handlePhotoError(photo) {
            if (photo.dataset.fallbackApplied === "1") {
                handlePhotoLoad(photo);
                return;
            }
            photo.dataset.fallbackApplied = "1";
            photo.src = "noimage.png";
        }

       

        
        function createPhotoBox(roll, imageUrl, nameHtml) {
            const box = document.createElement("div");
            box.className = "box";
            box.innerHTML = `
                <h3>${roll}</h3>
                <div class="photo-shell is-loading">
                    <div class="photo-loader" aria-hidden="true"></div>
                    <!-- FIX: Added loading="lazy" to prevent network freezing -->
                    <img class="photo" decoding="async" loading="lazy" src="${imageUrl}" alt="Student Photo" onload="handlePhotoLoad(this)" onerror="handlePhotoError(this)">
                </div>
                ${nameHtml}
            `;
            return box;
        }


       

        

        async function generatePhotos() {
            const inputField = document.getElementById("rollNumberInput");
            const input = inputField.value.trim().toUpperCase();
            const searchId = ++activePrefixSearchId;

            if (input === "") {
                showError("Please enter a name, roll number, or prefix.");
                return;
            }

            const container = document.getElementById("photoContainer");
            const pagination = document.getElementById("pagination");
            const branchDisplay = document.getElementById("branchDisplay");

            document.getElementById("scrollGif").style.display = "none";
            container.innerHTML = "";
            pagination.innerHTML = "";
            branchDisplay.style.display = "none";
            
            // UI text summary removed
            setGenerationLoading(true);

            try {
                const hasNumbers = /\d/.test(input);
                const isNameSearch = !hasNumbers || input.includes(" ");

                if (!isNameSearch) {
                    // 1. EXACT ROLL NUMBER
                    if (input.length >= 10) {
                        const imageUrl = getPhotoUrl(input);
                        const exists = await checkImageExists(imageUrl);
                        if (!exists) {
                            setGenerationLoading(false);
                            showError("Photo not found.");
                            return;
                        }

                        const fragment = document.createDocumentFragment();
                        if (checkIsLE(input)) {
                            appendLeBanner(fragment);
                        }

                        const box = createPhotoBox(
                            input,
                            imageUrl,
                            `<div class="student-name" id="name-${input}"><span class="dot-loader"><span></span><span></span><span></span></span></div>`
                        );
                        fragment.appendChild(box);
                        container.appendChild(fragment);
                        observer.observe(box);

                        displayBranch(input);
                        setGenerationLoading(false);
                        launchConfetti();

                        const nameEl = document.getElementById(`name-${input}`);
                        if (nameEl) {
                            fetchNameWithRetry(input, nameEl, 1);
                        }

                        setTimeout(() => {
                            box.classList.add("animate");
                            box.scrollIntoView({ behavior: "smooth", block: "center" });
                        }, 300);
                        return;
                    }

                    // 2. PREFIX SEARCH
                    if (input.length >= 7 && input.length < 10) {
                        const prefixes = getPrefixVariants(input);
                        validImages = [];
                        currentPage = 0;
                        
                        setGenerationLoading(true);
                        let foundInDb = false;

                        // BLAZING FAST APPROACH: Grab the entire branch range from Firestore instantly
                        if (cloudDb) {
                            try {
                                const queries = prefixes.map(prefix => {
                                    return cloudDb.collectionGroup('students')
                                        .orderBy('roll')
                                        .startAt(prefix)
                                        .endAt(prefix + '\uf8ff')
                                        .get();
                                });

                                const snapshots = await Promise.all(queries);
                                snapshots.forEach(snapshot => {
                                    snapshot.forEach(doc => {
                                        const data = doc.data();
                                        const roll = data.roll || doc.id;
                                        validImages.push({ 
                                            roll: roll, 
                                            imageUrl: getPhotoUrl(roll), 
                                            name: data.name 
                                        });
                                        // Cache locally so we don't fetch names again
                                        if (data.name) setCachedName(roll, data.name, selectedCollege);
                                    });
                                });

                                if (validImages.length > 0) {
                                    foundInDb = true;
                                }
                            } catch (e) {
                                console.warn("Fast DB fetch failed, falling back to discovery", e);
                            }
                        }

                        // IF FOUND IN DB: Render ALL of them instantly. Zero chunking delay!
                        if (foundInDb) {
                            // Sort ascending so Regular and LE students are perfectly in order
                            validImages.sort((a, b) => a.roll.localeCompare(b.roll));
                            
                            setGenerationLoading(false);
                            displayBranch(input);
                            displayPhotos(); // Instantly draws up to 100 boxes!
                            document.getElementById("scrollGif").style.display = "block";
                            launchConfetti();
                            return; 
                        }

                        // FALLBACK: DISCOVERY MODE (Only runs for brand-new batches not in DB yet)
                        let renderedInitialBatch = false;
                        let confettiLaunched = false;
                        toggleInlineLoader(true);
        
                        for (const prefix of prefixes) {
                            const rollNumbers = generateRollNumbers(prefix);
                            let consecutiveMisses = 0; 
                            const chunkSize = 50; 
                            
                            for (let i = 0; i < rollNumbers.length; i += chunkSize) {
                                if (searchId !== activePrefixSearchId) {
                                    toggleInlineLoader(false);
                                    return;
                                }
        
                                const chunk = rollNumbers.slice(i, i + chunkSize);
                                
                                const results = await Promise.all(
                                    chunk.map(async (roll) => {
                                        const url = getPhotoUrl(roll);
                                        const exists = await checkImageExists(url);
                                        return { roll, url, exists };
                                    })
                                );
        
                                let chunkHasValid = false;
                                for (const res of results) {
                                    if (res.exists) {
                                        validImages.push({ roll: res.roll, imageUrl: res.url });
                                        consecutiveMisses = 0;
                                        chunkHasValid = true;
                                    } else {
                                        consecutiveMisses++;
                                    }
                                }
        
                                if (validImages.length > 0 && !renderedInitialBatch) {
                                    setGenerationLoading(false);
                                    displayBranch(input);
                                    displayPhotos();
                                    document.getElementById("scrollGif").style.display = "block";
                                    renderedInitialBatch = true;
                                    if (!confettiLaunched) {
                                        launchConfetti();
                                        confettiLaunched = true;
                                    }
                                } else if (chunkHasValid && renderedInitialBatch) {
                                    displayPhotos();
                                }
        
                                toggleInlineLoader(true);

                                if (consecutiveMisses >= 5) {
                                    break; 
                                }
                            }
                        }
                        
                        toggleInlineLoader(false);
        
                        if (searchId !== activePrefixSearchId) return;
        
                        if (validImages.length === 0) {
                            setGenerationLoading(false);
                            showError("No photos found for this prefix.");
                        }
                        return;
                    }
                    showError("Invalid roll number or prefix length. Needs at least 7 characters.");
                    setGenerationLoading(false);
                    return;
                }

                // 3. NAME-BASED SEARCH
                const response = await fetch("https://student-name-api.onrender.com/resolve_name_to_roll", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: "query=" + encodeURIComponent(input) + "&college=" + encodeURIComponent(selectedCollege)
                });

                const data = await response.json();
                if (data.error) {
                    setGenerationLoading(false);
                    console.error("API Error:", data.error);
                    if (data.error === "Query too short") {
                        showError("Please enter at least 3 characters for a name search.");
                    } else {
                        showError("Server error occurred while searching. Please try again later.");
                    }
                    return;
                }

                if (!Array.isArray(data) || data.length === 0) {
                    setGenerationLoading(false);
                    showError(`No student found for "${input}" in ${selectedCollege}. Try checking another college tab.`);
                    return;
                }

                const campusNames = { MH: "ACOE", P3: "ACET", A9: "AEC", AU: "Aditya University (AU)", B1: "Aditya University (AU)", B11: "Aditya University (AU)" };
                const campusOrder = ["MH", "P3", "A9", "AU", "B1", "B11"];
                const grouped = {};

                for (let { roll, name, branch, campus } of data) {
                    setCachedName(roll, name, selectedCollege);
                    upsertNameInCloudDb(roll, name, selectedCollege);
                    const year = roll.substring(0, 2);
                    const series = (selectedCollege === "AU" || campus === "AU" || roll.includes("B11") || roll.includes("M11")) ? "AU" : roll.substring(2, 4);
                    if (!grouped[year]) grouped[year] = { MH: [], P3: [], A9: [], AU: [], B1: [], B11: [] };
                    const imageUrl = getPhotoUrl(roll);
                    if (!grouped[year][series]) grouped[year][series] = [];
                    grouped[year][series].push({ roll, name, branch, campus: campusNames[series] || campus, imageUrl });
                }

                container.innerHTML = "";
                const sortedYears = Object.keys(grouped).sort((a, b) => b - a);
                for (const year of sortedYears) {
                    const yearWrapper = document.createElement("div");
                    yearWrapper.style.width = "100%";
                    yearWrapper.style.display = "flex";
                    yearWrapper.style.justifyContent = "center";
                    yearWrapper.style.marginTop = "20px";

                    const yearBanner = document.createElement("div");
                    yearBanner.className = "branch-banner";
                    yearBanner.style.margin = "0";
                    yearBanner.style.display = "block";
                    yearBanner.innerText = `${year} Batch`;

                    yearWrapper.appendChild(yearBanner);
                    container.appendChild(yearWrapper);

                    for (const series of campusOrder) {
                        const students = grouped[year][series];
                        if (!students || !students.length) continue;

                        students.forEach(({ roll, name, branch, campus, imageUrl }) => {
                            // 1. Check if this specific roll number is an LE
                            const isLE = checkIsLE(roll);
                            
                            // 2. Create a clean, modern orange badge only if they are LE
                            const leBadge = isLE ? ` <span style="color: #f97316; font-weight: 800; font-size: 13px; margin-left: 4px;">(LE)</span>` : "";

                            const box = createPhotoBox(
                                roll,
                                imageUrl,
                                `<div class="student-name">${name}</div><div style="margin-top: 5px;"><strong>Branch:</strong> ${branch}${leBadge}</div><div style="margin-top: 2px;"><strong>Campus:</strong> ${campus || (campusNames[series] || series)}</div>`
                            );
                            container.appendChild(box);
                            observer.observe(box);
                        });
                    }
                }

                setGenerationLoading(false);
                launchConfetti();
            } catch (error) {
                console.error("Fetch Error:", error);
                setGenerationLoading(false);
                showError("Failed to connect to the server. Please wait for the status dot to turn green and try again.");
            }
        }
        function displayPhotos() {
            const container = document.getElementById("photoContainer");
            container.innerHTML = "";

            const start = currentPage * imagesPerPage;
            const end = start + imagesPerPage;
            const imagesToShow = validImages.slice(start, end);
            const fragment = document.createDocumentFragment();
            let leBannerShown = false;

            imagesToShow.forEach(({ roll, imageUrl }) => {
                const isLE = checkIsLE(roll);
                if (isLE && !leBannerShown) {
                    appendLeBanner(fragment);
                    leBannerShown = true;
                }

                const box = createPhotoBox(
                    roll,
                    imageUrl,
                    `<div class="student-name" id="name-${roll}"><span class="dot-loader"><span></span><span></span><span></span></span></div>`
                );
                fragment.appendChild(box);

                const nameEl = box.querySelector(`#name-${roll}`);
                if (nameEl) {
                    fetchNameWithRetry(roll, nameEl, 1);
                }
                observer.observe(box);
            });

            container.appendChild(fragment);
            setTimeout(() => {
                const firstBox = container.querySelector(".box");
                if (firstBox) firstBox.classList.add("animate");
            }, 50);

            renderPagination();
        }

function renderPagination() {
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";
    const totalPages = Math.ceil(validImages.length / imagesPerPage);

    if (totalPages > 1) {
        if (currentPage > 0) {
            const prevBtn = document.createElement("button");
            prevBtn.textContent = "⟨ Prev";
            prevBtn.onclick = () => {
                currentPage--;
                displayPhotos();
                window.scrollTo(0, 0);
            };
            pagination.appendChild(prevBtn);
        }

        for (let i = 0; i < totalPages; i++) {
            const pageBtn = document.createElement("button");
            pageBtn.textContent = i + 1;
            if (i === currentPage) {
                pageBtn.style.backgroundColor = "orange";
                pageBtn.style.color = "white";
                pageBtn.disabled = true;
            }
            pageBtn.onclick = () => {
                currentPage = i;
                displayPhotos();
                window.scrollTo(0, 0);
            };
            pagination.appendChild(pageBtn);
        }

        if (currentPage < totalPages - 1) {
            const nextBtn = document.createElement("button");
            nextBtn.textContent = "Next ⟩";
            nextBtn.onclick = () => {
                currentPage++;
                displayPhotos();
                window.scrollTo(0, 0);
            };
            pagination.appendChild(nextBtn);
        }
    }
}

async function clearTemporaryCache() {
    let clearedNames = 0;
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach((key) => {
        if (isStudentRollCacheKey(key)) {
            localStorage.removeItem(key);
            clearedNames++;
        }
    });

    let clearedImageCaches = 0;
    if ("caches" in window) {
        const cacheKeys = await caches.keys();
        clearedImageCaches = cacheKeys.length;
        await Promise.all(cacheKeys.map(cacheName => caches.delete(cacheName)));
    }

    alert(`Cache cleared: ${clearedNames} name entries and ${clearedImageCaches} image cache groups removed.`);
}

const observerOptions = {
    root: null,
    rootMargin: "-40% 0px -40% 0px", 
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate');
        } 
    });
}, observerOptions);
        function generateRollNumbers(basePrefix) {
            let rollNumbers = [];

            // Check for AU prefixes (including B21 from your screenshots)
            if (selectedCollege === "AU" || basePrefix.includes("B11") || basePrefix.includes("B21") || basePrefix.includes("M11") || basePrefix.includes("M12") || basePrefix.includes("B12")) {

                // 1. Generate 001 to 999 for AU
                for (let i = 1; i <= 999; i++) {
                    rollNumbers.push(basePrefix + i.toString().padStart(3, '0'));
                }

                // 2. Generate A01 to Z99 for AU (Lateral Entry / Overflow)
                for (let letter = 65; letter <= 90; letter++) {
                    for (let i = 1; i <= 99; i++) {
                        rollNumbers.push(basePrefix + String.fromCharCode(letter) + i.toString().padStart(2, '0'));
                    }
                }

            } else {
                // Traditional AEC / ACET format
                // 1. Generate 01 to 99
                for (let i = 1; i <= 99; i++) {
                    rollNumbers.push(basePrefix + i.toString().padStart(2, '0'));
                }
                // 2. Generate A0 to Z9
                for (let letter = 65; letter <= 90; letter++) {
                    for (let number = 0; number <= 9; number++) {
                        rollNumbers.push(basePrefix + String.fromCharCode(letter) + number);
                    }
                }
            }
            return rollNumbers;
        }

        // --- 1. LATERAL ENTRY (LE) CORE LOGIC ---

// Helper function to identify AU prefixes
function isAuPrefix(prefix) {
    return selectedCollege === "AU" || 
           prefix.includes("B11") || prefix.includes("B12") || 
           prefix.includes("M11") || prefix.includes("M12") ||
           prefix.includes("B21"); 
}

// Helper function to detect if a roll number is a Lateral Entry
function checkIsLE(roll) {
    if (!roll || roll.length < 7) return false;
    
    // AU Lateral Entry Check (Strictly B21)
    if (isAuPrefix(roll)) {
        return roll.includes("B21");
    }
    
    // AEC / ACET Lateral Entry Check
    return roll.substring(4, 6) === "5A" || roll.substring(4, 5) === "5";
}

function shouldGenerateLePrefix(prefix) {
    if (prefix.length < 7 || prefix.length > 9) return false;

    // AU Handling - ONLY generate LEs if the prefix is B11
    if (isAuPrefix(prefix)) {
        return prefix.includes("B11");
    }

    // AEC / ACET Handling
    if (prefix.substring(4, 5) === "5") return false;
    
    const seriesCode = prefix.substring(2, 4);
    return seriesCode === "P3" || seriesCode === "A9" || seriesCode === "MH";
}

function convertToLE(prefix) {
    var year = parseInt(prefix.substring(0, 2)) + 1;

    // AU Conversion Logic (Strictly 24B11 -> 25B21)
    if (isAuPrefix(prefix) && prefix.includes("B11")) {
        let leSeries = prefix.substring(2, 5).replace("B11", "B21");
        return year.toString() + leSeries + prefix.substring(5);
    }

    // AEC / ACET Conversion Logic
    var branchCode = prefix.startsWith("23MH") ? "P3" : prefix.substring(2, 4);
    return year.toString() + branchCode + "5" + prefix.substring(5);
}

function getPrefixVariants(prefix) {
    const prefixes = [prefix];
    if (shouldGenerateLePrefix(prefix)) {
        const lePrefix = convertToLE(prefix);
        if (lePrefix && lePrefix !== prefix) {
            prefixes.push(lePrefix);
        }
    }
    return prefixes;
}

        function handleKeyPress(event) {
            if (event.key === "Enter") {
                event.target.blur();
                generatePhotos();
            }
        }
   
        const branchMap = {
    "01": "CE", "02": "EEE", "03": "ME", "04": "ECE", "05": "CSE", 
    "12": "IT","14": "ECT", "15": "CSSE", "19": "ECE","26": "Mining",
    "27": "PT","00": "Pharmacy","42": "CSE-AIML","44": "DS","49": "IoT", "61":"AIML"
};

    const auBranchMap = {
        "AI": "AIML", "AD": "AIDS", "CS": "CSE", "EC": "ECE", "EE": "EEE", 
        "ME": "ME", "CE": "CE", "IT": "IT", "CT": "CST", "CW": "Cyber Security", 
        "IO": "IoT", "MI": "Mining", "PT": "Petroleum", "AG": "Agriculture",
        "MC": "MCA", "MB": "MBA", "BB": "BBA"
    };

function displayBranch(rollNumber) {
    if (rollNumber.length >= 7) { 
        const displayDiv = document.getElementById("branchDisplay");

        let isAU = selectedCollege === "AU" || rollNumber.includes("B11") || rollNumber.includes("M11") || rollNumber.includes("M12") || rollNumber.includes("B12");

        let branch = isAU ? (auBranchMap[rollNumber.slice(5, 7)] || rollNumber.slice(5, 7)) : branchMap[rollNumber.slice(6, 8)];

        if (branch) {
            displayDiv.textContent = isAU ? `AU Branch: ${branch}` : `${branch}`;
            displayDiv.style.display = "block";
        } else {
            displayDiv.style.display = "none";
        }
    } else {
        document.getElementById("branchDisplay").style.display = "none";
    }
}

    
window.addEventListener('scroll', () => {
    const gif = document.getElementById('scrollGif');
    if (window.scrollY > 50) {
        gif.style.display = 'none';
    }
});

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')

      .then(function(registration) {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(function(error) {
        console.error('Service Worker registration failed:', error);
      });
  }


    window.onscroll = function() {
        const btn = document.getElementById("scrollToTopBtn");
        if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
            btn.style.display = "flex"; 
        } else {
            btn.style.display = "none";
        }
    };

    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

window.addEventListener("scroll", () => {
  if (window.scrollY === 0) {
    const firstBox = document.querySelector(".box");
    if (firstBox) {
      firstBox.classList.remove("animate"); 
      void firstBox.offsetWidth; 
      firstBox.classList.add("animate"); 
    }
  }
});

function launchConfetti() {
  confetti({
    particleCount: 200,
    spread: 70,
    origin: { y: 0.6 }
  });
}

let deferredPrompt = null;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(reg => console.log('✅ Service Worker registered:', reg))
    .catch(err => console.error('❌ Service Worker error:', err));
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const dontShow = localStorage.getItem('pwaDontShowAgain') === 'true';
  const isInstalled = localStorage.getItem('pwaInstalled') === 'true';

  if (!dontShow && !isInstalled) {
    document.getElementById('popup-overlay').style.display = 'flex';
  }
});

window.addEventListener('appinstalled', () => {
  console.log('✅ App installed');
  localStorage.setItem('pwaInstalled', 'true');

  setTimeout(() => {
    document.getElementById('open-in-app-popup').style.display = 'block';
    document.getElementById('popup-overlay').style.display = 'none';
  }, 12500);
});

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('installBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (deferredPrompt) {
      deferredPrompt.prompt();

      const choiceResult = await deferredPrompt.userChoice;
      console.log('🔔 User choice:', choiceResult.outcome);

      if (document.getElementById('dontShowAgain').checked) {
        localStorage.setItem('pwaDontShowAgain', 'true');
      }

      document.getElementById('popup-overlay').style.display = 'none';
      deferredPrompt = null;
    }
  });

  document.getElementById('closeBtn').addEventListener('click', () => {
    if (document.getElementById('dontShowAgain').checked) {
      localStorage.setItem('pwaDontShowAgain', 'true');
    }
    document.getElementById('popup-overlay').style.display = 'none';
  });
});

function openPWA() {
  window.open('https://23mh1a1202.github.io/student_photos/index.html', '_blank');
  closeInAppPopup();
}

function closeInAppPopup() {
  document.getElementById('open-in-app-popup').style.display = 'none';
  document.getElementById('popup-overlay').style.display = 'none';
}


function showError(message) {
    const overlay = document.getElementById("error-overlay");
    const messageBox = document.getElementById("error-message");
    messageBox.textContent = message;
    overlay.style.display = "flex"; 
}

function refreshAfterPopup() {
    location.reload(); 
}

// ✅ Info Popup Controls
function showInfoPopup() {
    document.getElementById('info-overlay').style.display = 'flex';
}
function closeInfoPopup() {
    document.getElementById('info-overlay').style.display = 'none';
}

// ✅ Enhanced Background Request to Wake Up Render Server
function pingRenderServer(retries = 6) {
    const statusDot = document.getElementById('api-status-dot');
    const statusText = document.getElementById('api-status-text');

    // Update UI if we are in a retry state
    if (retries < 6) {
        statusText.innerText = "Waking Server...";
        statusText.style.color = "#f97316"; // Match your modern orange
        statusDot.style.backgroundColor = "#f97316";
        statusDot.classList.remove('ready');
    }

    fetch("https://student-name-api.onrender.com/get_name", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "roll_number=23MH1A1202&college=ACET" // Hidden wake-up ping
    })
    .then(res => {
        if (!res.ok) throw new Error("Server is still booting up");
        return res.json();
    })
    .then(data => {
        if (data) {
            // Success! Server is awake.
            statusDot.style.backgroundColor = ""; // Clear inline styles
            statusDot.classList.add('ready');
            statusText.innerText = "Ready";
            statusText.style.color = "#22c55e"; // Modern green
        }
    })
    .catch(err => {
        if (retries > 0) {
            // Wait 8 seconds and try again (covers Render's ~45s boot time)
            setTimeout(() => pingRenderServer(retries - 1), 8000);
        } else {
            // Server completely failed to wake up after 1 minute
            console.log("Wake-up ping failed:", err);
            statusDot.style.backgroundColor = "#ef4444"; // Red
            statusText.innerText = "Offline";
            statusText.style.color = "#ef4444";
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Keep your input auto-capitalize logic
    const input = document.getElementById("rollNumberInput");
    if (input) {
        input.addEventListener("input", () => {
            input.value = input.value.toUpperCase();
        });
    }

    // Start the ping process as soon as the page loads
    pingRenderServer();
});



function initStars() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  stars = [];

  const starCount = Math.floor(canvas.width * canvas.height / 6000); 

  for (let i = 0; i < starCount; i++) {
    const speed = Math.random() * 0.2 + 0.05;
    const angle = Math.random() * Math.PI * 2;
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2.2 + 0.8,
      alpha: Math.random() * 0.4 + 0.6,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed
    });
  }
}

function spawnShootingStar() {
  const startX = Math.random() * canvas.width;
  const startY = Math.random() * canvas.height;

  shootingStars.push({
    x: startX,
    y: startY,
    vx: Math.random() * 6 + 5,   
    vy: Math.random() * 3 + 2,   
    length: Math.random() * 100 + 80,
    alpha: 1,
    fadeRate: 0.006
  });
}


function animateStars() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let star of stars) {
    star.x += star.dx;
    star.y += star.dy;

    if (star.x < 0) star.x = canvas.width;
    if (star.x > canvas.width) star.x = 0;
    if (star.y < 0) star.y = canvas.height;
    if (star.y > canvas.height) star.y = 0;

    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(255, 140, 0, ${star.alpha})`;
    ctx.shadowBlur = 6;
    ctx.shadowColor = `rgba(255, 140, 0, ${star.alpha})`;
    ctx.fill();
  }

  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const s = shootingStars[i];
const trailX = s.x - s.length;
const trailY = s.y - s.length * 0.5;

const grad = ctx.createLinearGradient(s.x, s.y, trailX, trailY);
grad.addColorStop(0, `rgba(0, 191, 255, ${s.alpha})`);
grad.addColorStop(1, `rgba(0, 191, 255, 0)`);

ctx.beginPath();
ctx.moveTo(s.x, s.y);
ctx.lineTo(trailX, trailY);
ctx.strokeStyle = grad;
ctx.lineWidth = 3;
ctx.shadowBlur = 25;
ctx.shadowColor = `rgba(0,191,255,${s.alpha})`;
ctx.stroke();

    s.x += s.vx;
    s.y += s.vy;
    s.alpha -= s.fadeRate;

    if (s.alpha <= 0 || s.x < -200 || s.y > canvas.height + 100) {
      shootingStars.splice(i, 1);
    }
  }

  requestAnimationFrame(animateStars);
}

window.addEventListener('resize', () => {
  initStars();
});

window.addEventListener('load', () => {
  initStars();
  animateStars();

 setInterval(() => {
  const count = Math.random() > 0.3 ? 2 : 3; 
  for (let i = 0; i < count; i++) {
    spawnShootingStar();
  }
}, Math.random() * 800 + 1200); 

});

    const canvas = document.getElementById('starCanvas');
    const ctx = canvas.getContext('2d');

    let stars = [];
    let shootingStars = [];

    function initStars() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = [];

      const starCount = Math.floor(canvas.width * canvas.height / 6000); 

      for (let i = 0; i < starCount; i++) {
        const speed = Math.random() * 0.2 + 0.05;
        const angle = Math.random() * Math.PI * 2;
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 2.2 + 0.8,
          alpha: Math.random() * 0.4 + 0.6,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed
        });
      }
    }

    function spawnShootingStar() {
      // 🚀 FIX 1: Performance Safeguard. Never allow more than 15 shooting stars to exist in memory at once.
      if (shootingStars.length > 15) return;

      const startX = Math.random() * canvas.width;
      const startY = Math.random() * canvas.height;

      shootingStars.push({
        x: startX,
        y: startY,
        vx: Math.random() * 6 + 5,   
        vy: Math.random() * 3 + 2,   
        length: Math.random() * 100 + 80,
        alpha: 1,
        fadeRate: 0.006
      });
    }

    function animateStars() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let star of stars) {
        star.x += star.dx;
        star.y += star.dy;

        if (star.x < 0) star.x = canvas.width;
        if (star.x > canvas.width) star.x = 0;
        if (star.y < 0) star.y = canvas.height;
        if (star.y > canvas.height) star.y = 0;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255, 140, 0, ${star.alpha})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(255, 140, 0, ${star.alpha})`;
        ctx.fill();
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        const trailX = s.x - s.length;
        const trailY = s.y - s.length * 0.5;

        const grad = ctx.createLinearGradient(s.x, s.y, trailX, trailY);
        grad.addColorStop(0, `rgba(0, 191, 255, ${s.alpha})`);
        grad.addColorStop(1, `rgba(0, 191, 255, 0)`);

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(trailX, trailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 25;
        ctx.shadowColor = `rgba(0,191,255,${s.alpha})`;
        ctx.stroke();

        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= s.fadeRate;

        if (s.alpha <= 0 || s.x < -200 || s.y > canvas.height + 100) {
          shootingStars.splice(i, 1);
        }
      }

      requestAnimationFrame(animateStars);
    }

    window.addEventListener('resize', () => {
      initStars();
    });

    window.addEventListener('load', () => {
      initStars();
      animateStars();

      setInterval(() => {
        // 🚀 FIX 2: Stop the interval from spawning stars when the user switches to a different tab!
        if (document.hidden) return;

        const count = Math.random() > 0.3 ? 2 : 3; 
        for (let i = 0; i < count; i++) {
          spawnShootingStar();
        }
      }, 1500); // Set to a fixed 1.5 second interval to prevent stacking
    });

async function updateVisitorCounter() {
    const countSpan = document.getElementById("visitor-count");
    if (!countSpan) return;

    const PRESET_BASELINE = 527; // Base historical count

    // ✅ Fixed check: checks 'cloudDb' directly instead of 'window.cloudDb'
    if (typeof cloudDb === "undefined" || !cloudDb) {
        setTimeout(updateVisitorCounter, 300);
        return;
    }

    // Path stays under 'colleges' to pass your Firestore Security Rules
    const counterDocRef = cloudDb
        .collection("colleges")
        .doc("APP_STATS")
        .collection("metrics")
        .doc("visitors");

    try {
        const hasCountedSession = sessionStorage.getItem("site_counted");

        // 1. Increment counter once per session
        if (!hasCountedSession) {
            await counterDocRef.set({
                count: firebase.firestore.FieldValue.increment(1),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            sessionStorage.setItem("site_counted", "true");
        }

        // 2. Real-time Firestore listener
        counterDocRef.onSnapshot((docSnap) => {
            if (docSnap.exists) {
                const currentCount = docSnap.data()?.count || 0;
                countSpan.innerText = (currentCount + PRESET_BASELINE).toLocaleString();
            } else {
                countSpan.innerText = PRESET_BASELINE.toLocaleString();
            }
        }, (error) => {
            console.warn("Live visitor listener issue:", error);
            countSpan.innerText = PRESET_BASELINE.toLocaleString();
        });

    } catch (error) {
        console.warn("Visitor counter error:", error);
        countSpan.innerText = PRESET_BASELINE.toLocaleString();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    updateVisitorCounter();
});
