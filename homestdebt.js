/* =========================================================
   STUDENTTRACK - STUDENT DASHBOARD
   homestdebt.js
========================================================= */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    setDoc,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =========================================================
   FIREBASE
========================================================= */

const auth = window.firebaseAuth;
const db = window.firebaseDB;
const onAuthStateChanged = window.firebaseOnAuthStateChanged;
const signOut = window.firebaseSignOut;


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let currentUser = null;
let currentStudent = null;

let allMarks = [];
let allAttendance = [];
let allLeaveRequests = [];

let chartInstances = {};

let currentJourney = "morning";

let busMap = null;
let busMarkers = {};
let selectedBusNumber = null;
let busLocationUnsubscribe = null;
let busLocationsCache = {};
let currentMatchingRoutes = [];

let studentProfileLoaded = false;

let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth();


/* =========================================================
   DOM HELPERS
========================================================= */

function $(id) {
    return document.getElementById(id);
}


function showLoading(show) {

    const overlay = $("loadingOverlay");

    if (!overlay) {
        return;
    }

    overlay.style.display = show ? "flex" : "none";
}


/* =========================================================
   AUTHENTICATION
========================================================= */
/* =========================================================
   INITIAL UI SETUP
========================================================= */

/*
 * IMPORTANT:
 * Set up all buttons and event listeners FIRST.
 * This means the dashboard navigation works even if
 * Firebase data takes time to load or one collection fails.
 */

setupNavigation();
setupFilters();
setupLeaveForm();
setupAttendance();
setupBusRoutes();
setupNotifications();


/* =========================================================
   AUTHENTICATION
========================================================= */

onAuthStateChanged(auth, async (user) => {

    /* -----------------------------------------------------
       USER NOT LOGGED IN
    ----------------------------------------------------- */

    if (!user) {

        window.location.href = "login.html";

        return;
    }


    /* -----------------------------------------------------
       SAVE CURRENT USER
    ----------------------------------------------------- */

    currentUser = user;

    showLoading(true);


    try {

        /* =================================================
           1. LOAD STUDENT PROFILE
        ================================================= */

        try {

            await loadStudentProfile();

        } catch (error) {

            console.error(
                "Student profile error:",
                error
            );

            alert(
                "Unable to load your student profile.\n\n" +
                error.message
            );

            showLoading(false);

            return;
        }


        /* =================================================
           2. LOAD MARKS
        ================================================= */

        try {

            await loadMarks();

        } catch (error) {

            console.error(
                "Marks loading error:",
                error
            );

            allMarks = [];

            showDataError(
                "marksTableBody",
                "Unable to load marks."
            );
        }


        /* =================================================
           3. LOAD ATTENDANCE
        ================================================= */

        try {

            await loadAttendance();

        } catch (error) {

            console.error(
                "Attendance loading error:",
                error
            );

            allAttendance = [];
        }


        /* =================================================
           4. LOAD LEAVE REQUESTS
        ================================================= */

        try {

            await loadLeaveRequests();

        } catch (error) {

            console.error(
                "Leave request loading error:",
                error
            );

            allLeaveRequests = [];
        }


        /* =================================================
           5. UPDATE STUDENT INFORMATION
        ================================================= */

        updateStudentUI();


        /* =================================================
           6. RENDER DASHBOARD
        ================================================= */

        renderOverview();

        renderMarks();

        renderPerformance();

        renderAttendance();

        renderLeaveRequests();

        updateLeaveAllowance();

        checkLeaveNotifications();


        /* =================================================
           7. HIDE LOADING SCREEN
        ================================================= */

        showLoading(false);


    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

        showLoading(false);

        alert(
            "Something went wrong while loading the dashboard.\n\n" +
            error.message
        );
    }

});


/* =========================================================
   SHOW DATA ERROR
========================================================= */

function showDataError(
    elementId,
    message
) {

    const element =
        $(elementId);


    if (!element) {
        return;
    }


    element.innerHTML = `
        <tr>
            <td
                colspan="6"
                class="empty-state"
            >
                ${escapeHTML(message)}
            </td>
        </tr>
    `;
}
/* =========================================================
   LOAD STUDENT PROFILE
========================================================= */

async function loadStudentProfile() {

    const studentRef = doc(
        db,
        "students",
        currentUser.uid
    );

    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {

        alert(
            "Student profile was not found. Please contact your counsellor."
        );

        await signOut(auth);

        window.location.href = "login.html";

        return;
    }

    currentStudent = {
        uid: currentUser.uid,
        ...studentSnap.data()
    };

    studentProfileLoaded = true;

    updateStudentUI();
}


/* =========================================================
   UPDATE STUDENT UI
========================================================= */

function updateStudentUI() {

    if (!currentStudent) {
        return;
    }

    const name =
        currentStudent.studentName ||
        currentStudent.name ||
        "Student";

    const id =
        currentStudent.studentId ||
        "--";

    const email =
        currentStudent.email ||
        currentUser?.email ||
        "--";


    if ($("studentName")) {
        $("studentName").textContent = name;
    }

    if ($("studentId")) {
        $("studentId").textContent = id;
    }

    if ($("studentEmail")) {
        $("studentEmail").textContent = email;
    }

    if ($("topStudentName")) {
        $("topStudentName").textContent = name;
    }

    if ($("topStudentId")) {
        $("topStudentId").textContent = id;
    }

    if ($("welcomeStudentName")) {
        $("welcomeStudentName").textContent = name;
    }

    if ($("leaveStudentName")) {
        $("leaveStudentName").value = name;
    }

    if ($("studentAvatar")) {

        $("studentAvatar").textContent =
            name.charAt(0).toUpperCase();
    }

    if ($("profileAvatarLarge")) {
        $("profileAvatarLarge").textContent = name.charAt(0).toUpperCase();
    }
    if ($("profileName")) {
        $("profileName").textContent = name;
    }
    if ($("profileStudentId")) {
        $("profileStudentId").textContent = id;
    }
    if ($("profileEmail")) {
        $("profileEmail").textContent = email;
    }
    if ($("profileDepartment")) {
        $("profileDepartment").textContent = currentStudent.department || "--";
    }
    if ($("profileSemester")) {
        const sem = getCurrentSemester();
        $("profileSemester").textContent = sem ? `Semester ${sem}` : "--";
    }
    if ($("profileMarksCount")) {
        $("profileMarksCount").textContent = allMarks.length;
    }
    if ($("profileAttendance")) {
        const sem = getCurrentSemester();
        const att = calculateAttendance(sem);
        $("profileAttendance").textContent = att.total === 0 ? "--%" : `${att.percentage.toFixed(1)}%`;
    }
}


/* =========================================================
   LOAD MARKS
========================================================= */

async function loadMarks() {

    if (!currentStudent) {
        return;
    }

    allMarks = [];

    const marksRef = collection(db, "marks");

    const q = query(
        marksRef,
        where(
            "studentId",
            "==",
            currentStudent.studentId
        )
    );

    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {

        allMarks.push({
            id: docSnap.id,
            ...docSnap.data()
        });

    });

    allMarks.sort((a, b) => {

        const semesterA =
            Number(a.semester) || 0;

        const semesterB =
            Number(b.semester) || 0;

        if (semesterA !== semesterB) {
            return semesterA - semesterB;
        }

        const examA =
            Number(String(a.examId ?? "").replace(/\D/g, "")) || 0;

        const examB =
            Number(String(b.examId ?? "").replace(/\D/g, "")) || 0;
        return examA - examB;
    });
}


/* =========================================================
   LOAD ATTENDANCE
========================================================= */

async function loadAttendance() {

    if (!currentStudent) {
        return;
    }

    allAttendance = [];

    const attendanceRef =
        collection(db, "attendance");

    const q = query(
        attendanceRef,
        where(
            "studentUid",
            "==",
            currentStudent.uid
        )
    );

    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {

        allAttendance.push({
            id: docSnap.id,
            ...docSnap.data()
        });

    });
}


/* =========================================================
   LOAD LEAVE REQUESTS
========================================================= */

async function loadLeaveRequests() {

    if (!currentStudent) {
        return;
    }

    allLeaveRequests = [];

    const leaveRef =
        collection(db, "leaveRequests");

    const q = query(
        leaveRef,
        where(
            "studentUid",
            "==",
            currentStudent.uid
        )
    );

    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {

        allLeaveRequests.push({
            id: docSnap.id,
            ...docSnap.data()
        });

    });

    allLeaveRequests.sort((a, b) => {

        const aTime =
            getTimestampMillis(a.submittedAt);

        const bTime =
            getTimestampMillis(b.submittedAt);

        return bTime - aTime;
    });
}


/* =========================================================
   TIMESTAMP HELPER
========================================================= */

function getTimestampMillis(timestamp) {

    if (!timestamp) {
        return 0;
    }

    if (
        typeof timestamp.toMillis === "function"
    ) {
        return timestamp.toMillis();
    }

    if (
        timestamp.seconds !== undefined
    ) {
        return timestamp.seconds * 1000;
    }

    if (
        timestamp instanceof Date
    ) {
        return timestamp.getTime();
    }

    const parsed =
        new Date(timestamp).getTime();

    return Number.isNaN(parsed)
        ? 0
        : parsed;
}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    const navItems =
        document.querySelectorAll(".nav-item");

    const tabs =
        document.querySelectorAll(".tab-content");

    navItems.forEach((item) => {

        item.addEventListener("click", () => {

            const tabName =
                item.dataset.tab;

            navItems.forEach((nav) => {
                nav.classList.remove("active");
            });

            item.classList.add("active");

            tabs.forEach((tab) => {
                tab.classList.remove("active");
            });

            const selectedTab =
                $(tabName + "Tab");
            if (selectedTab) {
                selectedTab.classList.add("active");
            }

            updatePageHeader(tabName);

            if (tabName === "performance") {
                renderPerformance();
            }

            if (tabName === "attendance") {
                renderAttendance();
            }

            if (tabName === "leave") {
                renderLeaveRequests();
                updateLeaveAllowance();
            }

            if (tabName !== "bus") {
                stopBusLocationListener();
            }

            if (tabName === "bus") {

                setTimeout(() => {

                    initializeBusMap();

                    if (busMap) {
                        busMap.invalidateSize();
                    }

                }, 100);
            }

        });

    });


    document.querySelectorAll(".quick-link-card").forEach(card => {
        card.addEventListener("click", () => {
            const target = card.dataset.goto;
            const navBtn = document.querySelector(`.nav-item[data-tab="${target}"]`);
            if (navBtn) navBtn.click();
        });
    });

    if ($("themeToggle")) {
        const saved = localStorage.getItem("studenttrack-theme");
        if (saved === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
            $("themeToggle").querySelector(".toggle-icon").textContent = "☀️";
            $("themeToggle").querySelector("span:last-child").textContent = "Light Mode";
        }
        $("themeToggle").addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme");
            if (current === "dark") {
                document.documentElement.removeAttribute("data-theme");
                localStorage.setItem("studenttrack-theme", "light");
                $("themeToggle").querySelector(".toggle-icon").textContent = "🌙";
                $("themeToggle").querySelector("span:last-child").textContent = "Dark Mode";
            } else {
                document.documentElement.setAttribute("data-theme", "dark");
                localStorage.setItem("studenttrack-theme", "dark");
                $("themeToggle").querySelector(".toggle-icon").textContent = "☀️";
                $("themeToggle").querySelector("span:last-child").textContent = "Light Mode";
            }
        });
    }

    if ($("logoutBtn")) {

        $("logoutBtn").addEventListener(
            "click",
            logoutStudent
        );

    }
}


/* =========================================================
   PAGE HEADER
========================================================= */

function updatePageHeader(tabName) {

    const titles = {

        overview: [
            "Dashboard",
            "Welcome back to StudentTrack"
        ],

        marks: [
            "My Marks",
            "View your examination performance"
        ],

        performance: [
            "Performance Analysis",
            "Analyze your academic performance"
        ],

        attendance: [
            "Attendance",
            "Track your attendance"
        ],

        leave: [
            "Leave Form",
            "Submit and track leave requests"
        ],

        bus: [
            "Bus Routes",
            "Find your college bus"
        ],

        profile: [
            "My Profile",
            "View your student profile"
        ]

    };

    const details =
        titles[tabName] ||
        titles.overview;

    if ($("pageTitle")) {
        $("pageTitle").textContent =
            details[0];
    }

    if ($("pageSubtitle")) {
        $("pageSubtitle").textContent =
            details[1];
    }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutStudent() {

    try {

        await signOut(auth);

        window.location.href = "login.html";

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        alert(
            "Unable to logout. Please try again."
        );
    }
}


/* =========================================================
   FILTERS
========================================================= */

function setupFilters() {

    if ($("marksSemesterFilter")) {

        $("marksSemesterFilter")
            .addEventListener(
                "change",
                renderMarks
            );
    }

    if ($("marksExamFilter")) {

        $("marksExamFilter")
            .addEventListener(
                "change",
                renderMarks
            );
    }

    if ($("performanceSemester")) {

        $("performanceSemester")
            .addEventListener(
                "change",
                renderPerformance
            );
    }

    if ($("semesterMaxMarks")) {

        $("semesterMaxMarks")
            .addEventListener(
                "input",
                renderPerformance
            );
    }

    if ($("exportPdfBtn")) {
        $("exportPdfBtn").addEventListener("click", exportPerformancePDF);
    }
}


/* =========================================================
   OVERVIEW
========================================================= */

function renderOverview() {

    if ($("totalMarksCount")) {

        $("totalMarksCount").textContent =
            allMarks.length;
    }


    const currentSemester =
        getCurrentSemester();

    if ($("overviewSemester")) {

        $("overviewSemester").textContent =
            currentSemester
                ? `Semester ${currentSemester}`
                : "--";
    }


    const attendance =
        calculateAttendance(currentSemester);

    if ($("overviewAttendance")) {

        if (attendance.total === 0) {

            $("overviewAttendance").textContent =
                "--";

        } else {

            $("overviewAttendance").textContent =
                `${attendance.percentage.toFixed(1)}%`;
        }
    }


    const leaveUsed =
        calculateLeaveUsed(currentSemester);

    if ($("overviewLeave")) {

        $("overviewLeave").textContent =
            `${leaveUsed} / 4`;
    }
}


/* =========================================================
   CURRENT SEMESTER
========================================================= */

function getCurrentSemester() {

    const semesters =
        allMarks
            .map(mark => Number(mark.semester))
            .filter(
                semester =>
                    semester >= 1 &&
                    semester <= 8
            );

    if (semesters.length === 0) {
        return null;
    }

    return Math.max(...semesters);
}


/* =========================================================
   MARKS
========================================================= */

function renderMarks() {

    const container = $("marksContainer");

    if (!container) {
        return;
    }

    let marks = [...allMarks];

    const semesterFilter =
        $("marksSemesterFilter")?.value ||
        "all";

    const examFilter =
        $("marksExamFilter")?.value ||
        "all";

    if (semesterFilter !== "all") {
        marks = marks.filter(
            mark => String(mark.semester) === String(semesterFilter)
        );
    }

    if (examFilter !== "all") {
        marks = marks.filter(
            mark => normalizeExamId(mark) === examFilter
        );
    }

    if (marks.length === 0) {
        container.innerHTML = `<div class="empty-state">No marks found for the selected filters.</div>`;
        return;
    }


    /*
     * Remove duplicate subject/exam records.
     * If multiple records exist, use the latest upload.
     */

    marks = getLatestMarkRecords(marks);


    const grouped = {};
    marks.forEach(mark => {
        const sem = mark.semester || "Other";
        if (!grouped[sem]) grouped[sem] = [];
        grouped[sem].push(mark);
    });

    container.innerHTML = "";

    const semesters = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));

    semesters.forEach(sem => {

        const semMarks = grouped[sem];

        let totalPercent = 0;
        let count = 0;
        semMarks.forEach(m => {
            const p = calculatePercentage(m);
            totalPercent += p;
            count++;
        });
        const avgPercent = count > 0 ? totalPercent / count : 0;

        const section = document.createElement("div");
        section.className = "marks-semester-group";

        section.innerHTML = `
            <div class="marks-semester-header">
                <div class="marks-semester-title">
                    <h3>Semester ${escapeHTML(String(sem))}</h3>
                    <span class="marks-subject-count">${count} subject${count !== 1 ? "s" : ""}</span>
                </div>
                <div class="marks-semester-avg">
                    <span class="marks-avg-label">Average</span>
                    <span class="marks-avg-value ${getBarClass(avgPercent)}">${avgPercent.toFixed(1)}%</span>
                </div>
            </div>
            <div class="marks-grid">
                ${semMarks.map(mark => {
                    const percentage = calculatePercentage(mark);
                    const status = getMarkStatus(percentage);
                    return `
                        <div class="marks-card">
                            <div class="marks-card-top">
                                <div class="marks-card-subject">${escapeHTML(mark.subject || "--")}</div>
                                <span class="status-badge ${status.className}">${status.label}</span>
                            </div>
                            <div class="marks-card-exam">${escapeHTML(getExamName(mark))}</div>
                            <div class="marks-card-score">
                                <span class="marks-obtained">${formatNumber(mark.marks)}</span>
                                <span class="marks-separator">/</span>
                                <span class="marks-total">${formatNumber(mark.maxMarks || 100)}</span>
                            </div>
                            <div class="percentage-cell">
                                <div class="progress-bar">
                                    <div
                                        class="progress-bar-fill ${getBarClass(percentage)}"
                                        style="width: ${Math.min(percentage, 100)}%"
                                    ></div>
                                </div>
                                <span class="percentage-text">${percentage.toFixed(1)}%</span>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;

        container.appendChild(section);
    });
}


/* =========================================================
   LATEST MARK RECORDS
========================================================= */

function getLatestMarkRecords(marks) {

    const map = new Map();

    marks.forEach(mark => {

        const key =
            [
                mark.semester,
                normalizeExamId(mark),
                String(mark.subject || "")
                    .trim()
                    .toLowerCase()
            ].join("|");


        const existing =
            map.get(key);


        if (!existing) {

            map.set(key, mark);

            return;
        }


        const existingTime =
            getTimestampMillis(
                existing.uploadedAt
            );

        const currentTime =
            getTimestampMillis(
                mark.uploadedAt
            );


        if (currentTime >= existingTime) {

            map.set(key, mark);
        }

    });


    return Array.from(map.values());
}


/* =========================================================
   EXAM HELPERS
========================================================= */

function normalizeExamId(mark) {

    const examId =
        String(
            mark.examId ||
            mark.exam ||
            ""
        )
        .toLowerCase()
        .replace(/\s+/g, "");


    if (
        examId.includes("model1") ||
        examId.includes("modelexam1") ||
        examId === "1"
    ) {
        return "model1";
    }

    if (
        examId.includes("model2") ||
        examId.includes("modelexam2") ||
        examId === "2"
    ) {
        return "model2";
    }

    if (
        examId.includes("model3") ||
        examId.includes("modelexam3") ||
        examId === "3"
    ) {
        return "model3";
    }


    const number =
        examId.match(/\d+/);


    if (number) {

        if (number[0] === "1") {
            return "model1";
        }

        if (number[0] === "2") {
            return "model2";
        }

        if (number[0] === "3") {
            return "model3";
        }
    }


    return examId;
}


function getExamName(mark) {

    const normalized =
        normalizeExamId(mark);


    if (normalized === "model1") {
        return "Model Exam 1";
    }

    if (normalized === "model2") {
        return "Model Exam 2";
    }

    if (normalized === "model3") {
        return "Model Exam 3";
    }


    return mark.exam ||
        mark.examId ||
        "--";
}


/* =========================================================
   MARK CALCULATIONS
========================================================= */

function calculatePercentage(mark) {

    const marks =
        Number(mark.marks);

    const maxMarks =
        Number(mark.maxMarks || 100);


    if (
        Number.isNaN(marks) ||
        Number.isNaN(maxMarks) ||
        maxMarks <= 0
    ) {
        return 0;
    }


    return (
        marks /
        maxMarks
    ) * 100;
}


function getBarClass(percentage) {

    if (percentage >= 80) return "good";
    if (percentage >= 70) return "moderate";
    if (percentage >= 50) return "warning";
    return "danger";
}


function getMarkStatus(percentage) {

    if (percentage < 50) {

        return {
            label: "High Priority",
            className: "danger"
        };
    }


    if (percentage < 70) {

        return {
            label: "Needs Attention",
            className: "warning"
        };
    }


    if (percentage < 80) {

        return {
            label: "Moderate",
            className: "info"
        };
    }


    return {
        label: "Good",
        className: "success"
    };
}


/* =========================================================
   PERFORMANCE ANALYSIS
========================================================= */

function renderPerformance() {

    const semester =
        Number(
            $("performanceSemester")?.value ||
            getCurrentSemester() ||
            1
        );


    const semesterMarks =
        allMarks.filter(
            mark =>
                Number(mark.semester) ===
                semester
        );


    const latestMarks =
        getLatestMarkRecords(
            semesterMarks
        );


    const subjectGroups =
        groupMarksBySubject(
            latestMarks
        );


    const predictions =
        calculateSubjectPredictions(
            subjectGroups
        );


    renderPredictionTable(predictions);

    renderPredictionSummary(
        predictions,
        semester
    );

    try { renderTrend(semester); } catch (e) { console.warn("Trend chart error:", e); }
    try { renderRadarChart(predictions); } catch (e) { console.warn("Radar chart error:", e); }
    try { renderSubjectBarChart(subjectGroups); } catch (e) { console.warn("Subject bar chart error:", e); }

    renderPriorityAreas(
        predictions
    );

    renderRecommendations(
        predictions
    );

    renderOverallInsight(
        predictions,
        semester
    );
}


/* =========================================================
   GROUP MARKS BY SUBJECT
========================================================= */

function groupMarksBySubject(marks) {

    const groups = {};


    marks.forEach(mark => {

        const subject =
            String(
                mark.subject ||
                "Unknown Subject"
            ).trim();


        if (!groups[subject]) {

            groups[subject] = {
                model1: null,
                model2: null,
                model3: null
            };
        }


        const exam =
            normalizeExamId(mark);


        if (
            exam === "model1" ||
            exam === "model2" ||
            exam === "model3"
        ) {

            groups[subject][exam] =
                calculatePercentage(mark);
        }

    });


    return groups;
}


/* =========================================================
   SUBJECT PREDICTIONS
========================================================= */

function calculateSubjectPredictions(groups) {

    const predictions = [];


    Object.entries(groups)
        .forEach(([subject, models]) => {

            const values = [];

            if (
                models.model1 !== null &&
                models.model1 !== undefined
            ) {

                values.push({
                    value: models.model1,
                    weight: 0.20,
                    model: "model1"
                });
            }


            if (
                models.model2 !== null &&
                models.model2 !== undefined
            ) {

                values.push({
                    value: models.model2,
                    weight: 0.30,
                    model: "model2"
                });
            }


            if (
                models.model3 !== null &&
                models.model3 !== undefined
            ) {

                values.push({
                    value: models.model3,
                    weight: 0.50,
                    model: "model3"
                });
            }


            if (values.length === 0) {

                predictions.push({

                    subject,

                    model1: models.model1,
                    model2: models.model2,
                    model3: models.model3,

                    predicted: null
                });

                return;
            }


            const totalWeight =
                values.reduce(
                    (sum, item) =>
                        sum + item.weight,
                    0
                );


            const predicted =
                values.reduce(
                    (sum, item) =>
                        sum +
                        (
                            item.value *
                            item.weight
                        ),
                    0
                ) /
                totalWeight;


            predictions.push({

                subject,

                model1: models.model1,
                model2: models.model2,
                model3: models.model3,

                predicted

            });

        });


    predictions.sort(
        (a, b) =>
            (a.predicted ?? 0) -
            (b.predicted ?? 0)
    );


    return predictions;
}


/* =========================================================
   PREDICTION TABLE
========================================================= */

function renderPredictionTable(predictions) {

    const container = $("predictionCardsContainer");
    if (!container) return;

    if (predictions.length === 0) {
        container.innerHTML = `<div class="empty-state">No marks available for this semester.</div>`;
        return;
    }

    container.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "pred-subject-grid";

    predictions.forEach(item => {

        const predicted = item.predicted;
        const status = predicted === null
            ? { label: "No Data", className: "info" }
            : getMarkStatus(predicted);

        const barClass = predicted !== null ? getBarClass(predicted) : "";

        const models = [
            { label: "M1", value: item.model1 },
            { label: "M2", value: item.model2 },
            { label: "M3", value: item.model3 }
        ];

        let trendHtml = "";
        if (item.model1 !== null && item.model3 !== null) {
            const diff = item.model3 - item.model1;
            if (diff > 3) trendHtml = `<span class="pred-subject-trend" style="color:#16a34a;">&#9650; +${diff.toFixed(0)}%</span>`;
            else if (diff < -3) trendHtml = `<span class="pred-subject-trend" style="color:#dc2626;">&#9660; ${diff.toFixed(0)}%</span>`;
        } else if (item.model1 !== null && item.model2 !== null) {
            const diff = item.model2 - item.model1;
            if (diff > 3) trendHtml = `<span class="pred-subject-trend" style="color:#16a34a;">&#9650; +${diff.toFixed(0)}%</span>`;
            else if (diff < -3) trendHtml = `<span class="pred-subject-trend" style="color:#dc2626;">&#9660; ${diff.toFixed(0)}%</span>`;
        }

        const card = document.createElement("div");
        card.className = "pred-subject-card";

        card.innerHTML = `
            <div class="pred-subject-top">
                <div class="pred-subject-name">${escapeHTML(item.subject)}</div>
                <div class="pred-subject-predicted ${barClass}">
                    ${predicted !== null ? predicted.toFixed(1) + "%" : "--"}
                </div>
            </div>
            <div class="pred-model-bars">
                ${models.map(m => {
                    if (m.value === null || m.value === undefined) {
                        return `
                            <div class="pred-model-row">
                                <span class="pred-model-label">${m.label}</span>
                                <div class="pred-model-bar-bg"><div class="pred-model-bar-fill" style="width:0%"></div></div>
                                <span class="pred-model-value" style="color:#ccc;">--</span>
                            </div>`;
                    }
                    const cls = getBarClass(m.value);
                    return `
                        <div class="pred-model-row">
                            <span class="pred-model-label">${m.label}</span>
                            <div class="pred-model-bar-bg"><div class="pred-model-bar-fill ${cls}" style="width:${Math.min(m.value, 100)}%"></div></div>
                            <span class="pred-model-value">${m.value.toFixed(1)}%</span>
                        </div>`;
                }).join("")}
            </div>
            <div class="pred-subject-status">
                <span class="status-badge ${status.className}">${status.label}</span>
                ${trendHtml}
            </div>
        `;

        grid.appendChild(card);
    });

    container.appendChild(grid);
}


/* =========================================================
   PREDICTION SUMMARY
========================================================= */

function renderPredictionSummary(
    predictions,
    semester
) {

    const validPredictions =
        predictions.filter(
            item =>
                item.predicted !== null
        );


    if (validPredictions.length === 0) {

        setText(
            "predictedGPA",
            "--"
        );

        setText(
            "modelsUsed",
            "--"
        );

        setText(
            "strongestSubject",
            "--"
        );

        setText(
            "weakestSubject",
            "--"
        );

        setText(
            "predictionDescription",
            "Not enough marks are available to calculate a prediction."
        );

        return;
    }


    const predictedPercentage =
        validPredictions.reduce(
            (sum, item) =>
                sum + item.predicted,
            0
        ) /
        validPredictions.length;


    const maxMarks =
        Number(
            $("semesterMaxMarks")?.value ||
            600
        );


    /*
     * Convert predicted percentage
     * to predicted semester score.
     */

    const predictedSemesterScore =
        (
            predictedPercentage /
            100
        ) *
        maxMarks;


    /*
     * Convert predicted semester score
     * into GPA out of 10.
     */

    const predictedGPA =
        (
            predictedSemesterScore /
            maxMarks
        ) *
        10;


    const gpaText = predictedGPA.toFixed(1);
    setText("predictedGPA", gpaText);

    const ring = $("gpaRingFill");
    if (ring) {
        const circumference = 2 * Math.PI * 52;
        const offset = circumference - (predictedGPA / 10) * circumference;
        ring.style.strokeDasharray = circumference;
        ring.style.strokeDashoffset = offset;

        if (predictedGPA >= 8) ring.style.stroke = "#22c55e";
        else if (predictedGPA >= 7) ring.style.stroke = "#3b82f6";
        else if (predictedGPA >= 5) ring.style.stroke = "#f59e0b";
        else ring.style.stroke = "#ef4444";
    }

    const modelsUsed = getModelsUsedForSemester(semester);
    setText("modelsUsed", modelsUsed);

    const strongest = [...validPredictions].sort((a, b) => b.predicted - a.predicted)[0];
    const weakest = [...validPredictions].sort((a, b) => a.predicted - b.predicted)[0];

    setText("strongestSubject", strongest?.subject || "--");
    setText("weakestSubject", weakest?.subject || "--");

    setText(
        "predictionDescription",
        `Predicted semester score: ${predictedSemesterScore.toFixed(1)} / ${maxMarks}. Based on ${validPredictions.length} subject${validPredictions.length !== 1 ? "s" : ""}.`
    );

    const confEl = $("predConfidence");
    if (confEl) {
        const modelCount = modelsUsed === "--" ? 0 : modelsUsed.split(",").length;
        let confLevel, confColor;
        if (modelCount >= 3) { confLevel = "High Confidence"; confColor = "rgba(74, 222, 128, 0.3)"; }
        else if (modelCount === 2) { confLevel = "Medium Confidence"; confColor = "rgba(251, 191, 36, 0.3)"; }
        else { confLevel = "Low Confidence"; confColor = "rgba(248, 113, 113, 0.3)"; }

        confEl.innerHTML = `
            <span class="pred-confidence-tag" style="background:${confColor}">${confLevel}</span>
            <span class="pred-confidence-tag">${validPredictions.length} subjects</span>
            <span class="pred-confidence-tag">${modelCount} model${modelCount !== 1 ? "s" : ""}</span>
        `;
    }
}


/* =========================================================
   MODELS USED
========================================================= */

function getModelsUsedForSemester(semester) {

    const marks =
        getLatestMarkRecords(
            allMarks.filter(
                mark =>
                    Number(mark.semester) ===
                    Number(semester)
            )
        );


    const models =
        new Set();


    marks.forEach(mark => {

        const exam =
            normalizeExamId(mark);


        if (
            exam === "model1" ||
            exam === "model2" ||
            exam === "model3"
        ) {

            models.add(exam);
        }

    });


    if (models.size === 0) {
        return "--";
    }


    return [...models]
        .sort()
        .map(model => {

            if (model === "model1") {
                return "Model 1";
            }

            if (model === "model2") {
                return "Model 2";
            }

            return "Model 3";

        })
        .join(", ");
}


/* =========================================================
   TREND
========================================================= */

function getChartColors() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
        text: isDark ? "#f1f5f9" : "#111827",
        muted: isDark ? "#94a3b8" : "#6b7280",
        grid: isDark ? "#334155" : "#e5e7eb",
        bg: isDark ? "#1e293b" : "#ffffff"
    };
}

function destroyChart(key) {
    if (chartInstances[key]) {
        chartInstances[key].destroy();
        chartInstances[key] = null;
    }
}


function renderTrend(semester) {

    const container = $("performanceTrend");
    const canvas = document.getElementById("trendChart");

    const marks = getLatestMarkRecords(
        allMarks.filter(mark => Number(mark.semester) === Number(semester))
    );

    const modelAverages = { model1: [], model2: [], model3: [] };

    marks.forEach(mark => {
        const exam = normalizeExamId(mark);
        if (exam === "model1" || exam === "model2" || exam === "model3") {
            modelAverages[exam].push(calculatePercentage(mark));
        }
    });

    const averages = {};
    Object.keys(modelAverages).forEach(model => {
        const values = modelAverages[model];
        if (values.length > 0) {
            averages[model] = values.reduce((a, b) => a + b, 0) / values.length;
        }
    });

    const available = Object.keys(averages);

    if (canvas && typeof Chart !== "undefined" && available.length > 0) {
        destroyChart("trend");
        const colors = getChartColors();
        const labels = available.map(m => m.replace("model", "Model "));
        const data = available.map(m => Math.round(averages[m] * 10) / 10);

        chartInstances.trend = new Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Average %",
                    data,
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37, 99, 235, 0.1)",
                    borderWidth: 3,
                    pointBackgroundColor: "#2563eb",
                    pointBorderColor: "#fff",
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: colors.bg,
                        titleColor: colors.text,
                        bodyColor: colors.text,
                        borderColor: colors.grid,
                        borderWidth: 1,
                        callbacks: {
                            label: ctx => `Average: ${ctx.parsed.y}%`
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0, max: 100,
                        ticks: { color: colors.muted, stepSize: 25, callback: v => v + "%" },
                        grid: { color: colors.grid }
                    },
                    x: {
                        ticks: { color: colors.muted },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    if (!container) return;

    if (available.length < 2) {
        container.textContent = "At least two model exams are required to identify a performance trend.";
        return;
    }

    const first = averages[available[0]];
    const last = averages[available[available.length - 1]];
    const difference = last - first;

    let icon, label, detail, cls;
    if (difference >= 5) {
        icon = "&#9650;"; cls = "improving";
        label = "Improving";
        detail = `Average rose by <strong>+${difference.toFixed(1)}%</strong> across model exams. Your preparation is paying off.`;
    } else if (difference <= -5) {
        icon = "&#9660;"; cls = "declining";
        label = "Declining";
        detail = `Average dropped by <strong>${Math.abs(difference).toFixed(1)}%</strong>. Review recent topics and adjust your study plan.`;
    } else {
        icon = "&#9654;"; cls = "";
        label = "Stable";
        detail = `Average changed by <strong>${difference.toFixed(1)}%</strong>. Performance is consistent across model exams.`;
    }

    container.innerHTML = `<span class="trend-icon ${cls}">${icon}</span> <strong>${label}</strong> — ${detail}`;
}


/* =========================================================
   RADAR CHART — Subject Strengths
========================================================= */

function renderRadarChart(predictions) {
    const canvas = document.getElementById("radarChart");
    if (!canvas || typeof Chart === "undefined") return;

    destroyChart("radar");

    const valid = predictions.filter(p => p.predicted !== null);
    if (valid.length === 0) return;

    const colors = getChartColors();
    const labels = valid.map(p => p.subject.length > 12 ? p.subject.slice(0, 12) + "…" : p.subject);
    const data = valid.map(p => Math.round(p.predicted * 10) / 10);

    chartInstances.radar = new Chart(canvas, {
        type: "radar",
        data: {
            labels,
            datasets: [{
                label: "Predicted %",
                data,
                borderColor: "#7c3aed",
                backgroundColor: "rgba(124, 58, 237, 0.15)",
                borderWidth: 2,
                pointBackgroundColor: "#7c3aed",
                pointBorderColor: "#fff",
                pointBorderWidth: 1,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: colors.bg,
                    titleColor: colors.text,
                    bodyColor: colors.text,
                    borderColor: colors.grid,
                    borderWidth: 1,
                    callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.r}%` }
                }
            },
            scales: {
                r: {
                    min: 0, max: 100,
                    ticks: { stepSize: 25, color: colors.muted, backdropColor: "transparent", font: { size: 10 } },
                    grid: { color: colors.grid },
                    angleLines: { color: colors.grid },
                    pointLabels: { color: colors.muted, font: { size: 11 } }
                }
            }
        }
    });
}


/* =========================================================
   SUBJECT BAR CHART — Model exam scores per subject
========================================================= */

function renderSubjectBarChart(subjectGroups) {
    const canvas = document.getElementById("subjectBarChart");
    if (!canvas || typeof Chart === "undefined") return;

    destroyChart("subjectBar");

    const subjects = Object.keys(subjectGroups);
    if (subjects.length === 0) return;

    const colors = getChartColors();
    const labels = subjects.map(s => s.length > 14 ? s.slice(0, 14) + "…" : s);

    const m1 = subjects.map(s => subjectGroups[s].model1);
    const m2 = subjects.map(s => subjectGroups[s].model2);
    const m3 = subjects.map(s => subjectGroups[s].model3);

    const datasets = [];
    if (m1.some(v => v !== null)) datasets.push({
        label: "Model 1", data: m1, backgroundColor: "rgba(37, 99, 235, 0.7)", borderColor: "#2563eb", borderWidth: 1, borderRadius: 4
    });
    if (m2.some(v => v !== null)) datasets.push({
        label: "Model 2", data: m2, backgroundColor: "rgba(234, 88, 12, 0.7)", borderColor: "#ea580c", borderWidth: 1, borderRadius: 4
    });
    if (m3.some(v => v !== null)) datasets.push({
        label: "Model 3", data: m3, backgroundColor: "rgba(22, 163, 74, 0.7)", borderColor: "#16a34a", borderWidth: 1, borderRadius: 4
    });

    if (datasets.length === 0) return;

    chartInstances.subjectBar = new Chart(canvas, {
        type: "bar",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "top",
                    labels: { color: colors.muted, usePointStyle: true, pointStyle: "rectRounded", padding: 16, font: { size: 12 } }
                },
                tooltip: {
                    backgroundColor: colors.bg,
                    titleColor: colors.text,
                    bodyColor: colors.text,
                    borderColor: colors.grid,
                    borderWidth: 1,
                    callbacks: { label: ctx => ctx.parsed.y !== null ? `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` : "" }
                }
            },
            scales: {
                y: {
                    min: 0, max: 100,
                    ticks: { color: colors.muted, stepSize: 25, callback: v => v + "%" },
                    grid: { color: colors.grid }
                },
                x: {
                    ticks: { color: colors.muted, font: { size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}


/* =========================================================
   PRIORITY AREAS
========================================================= */

function renderPriorityAreas(predictions) {

    const container = $("priorityAreas");
    if (!container) return;

    const weak = predictions
        .filter(item => item.predicted !== null && item.predicted < 70)
        .sort((a, b) => a.predicted - b.predicted);

    if (weak.length === 0) {
        container.innerHTML = `
            <div class="priority-item">
                <div class="pri-icon">&#10003;</div>
                <div class="pri-text">All subjects are above 70%. No major priority areas identified. Keep up the great work!</div>
            </div>`;
        return;
    }

    container.innerHTML = weak.map((item, i) => {
        const gap = (70 - item.predicted).toFixed(1);
        const severity = item.predicted < 50 ? "Critical" : "Attention needed";
        return `
            <div class="priority-item">
                <div class="pri-icon">${i + 1}</div>
                <div class="pri-text">
                    <strong>${escapeHTML(item.subject)}</strong> — predicted at <strong>${item.predicted.toFixed(1)}%</strong>.
                    ${severity}. Need <strong>${gap}%</strong> more to reach passing threshold.
                </div>
            </div>`;
    }).join("");
}


/* =========================================================
   RECOMMENDATIONS
========================================================= */

function renderRecommendations(predictions) {

    const container = $("recommendations");
    if (!container) return;

    const valid = predictions.filter(item => item.predicted !== null);

    if (valid.length === 0) {
        container.innerHTML = `
            <div class="recommendation-item">
                <div class="rec-icon">?</div>
                <div class="rec-text">Add more model exam marks to receive personalized recommendations.</div>
            </div>`;
        return;
    }

    const weak = valid.filter(item => item.predicted < 70);
    const moderate = valid.filter(item => item.predicted >= 70 && item.predicted < 80);
    const good = valid.filter(item => item.predicted >= 80);
    const recs = [];
    let num = 1;

    if (weak.length > 0) {
        const names = weak.map(w => w.subject).join(", ");
        recs.push({ num: num++, text: `<strong>Focus areas:</strong> Prioritize ${escapeHTML(names)}. These subjects are below 70% and need immediate attention. Dedicate extra study hours daily.` });

        weak.forEach(w => {
            if (w.model1 !== null && w.model2 !== null && w.model2 < w.model1) {
                recs.push({ num: num++, text: `<strong>${escapeHTML(w.subject)}</strong> dropped from Model 1 to Model 2. Identify which topics caused the decline and revisit those concepts.` });
            }
        });
    }

    if (moderate.length > 0) {
        recs.push({ num: num++, text: `<strong>Push for excellence:</strong> ${escapeHTML(moderate.map(m => m.subject).join(", "))} ${moderate.length === 1 ? "is" : "are"} in the 70-80% range. A small improvement here will significantly boost your GPA.` });
    }

    if (good.length > 0) {
        recs.push({ num: num++, text: `<strong>Keep it up:</strong> Your study approach for ${escapeHTML(good[0].subject)} is working well (${good[0].predicted.toFixed(1)}%). Apply similar strategies to other subjects.` });
    }

    const improving = valid.filter(w => w.model1 !== null && w.model3 !== null && w.model3 > w.model1 + 5);
    if (improving.length > 0) {
        recs.push({ num: num++, text: `<strong>Great progress:</strong> You've improved significantly in ${escapeHTML(improving.map(i => i.subject).join(", "))}. Your preparation method is effective — continue it.` });
    }

    recs.push({ num: num++, text: `<strong>Exam strategy:</strong> Review mistakes from all model exams. Focus on recurring error patterns rather than re-reading entire chapters.` });
    recs.push({ num: num++, text: `<strong>Consistency:</strong> Study regularly in shorter sessions rather than cramming before exams. Spaced repetition improves long-term retention.` });

    container.innerHTML = recs.map(r => `
        <div class="recommendation-item">
            <div class="rec-icon">${r.num}</div>
            <div class="rec-text">${r.text}</div>
        </div>
    `).join("");
}


/* =========================================================
   OVERALL INSIGHT
========================================================= */

function renderOverallInsight(
    predictions,
    semester
) {

    const element =
        $("overallInsight");


    if (!element) {
        return;
    }


    const valid =
        predictions.filter(
            item =>
                item.predicted !== null
        );


    if (valid.length === 0) {

        element.textContent =
            `There is not enough model-exam data for Semester ${semester} to generate an overall insight.`;

        return;
    }


    const average =
        valid.reduce(
            (sum, item) =>
                sum + item.predicted,
            0
        ) /
        valid.length;


    let emoji, label, advice;

    if (average >= 80) {
        emoji = "&#127775;"; label = "Excellent";
        advice = `Predicted average is <strong>${average.toFixed(1)}%</strong>. You're on track for a strong GPA. Maintain consistency and push weaker subjects to match your best.`;
    } else if (average >= 70) {
        emoji = "&#128161;"; label = "Good, can improve";
        advice = `Predicted average is <strong>${average.toFixed(1)}%</strong>. A moderate push on 2-3 subjects can significantly boost your GPA. Target the priority areas above.`;
    } else {
        emoji = "&#9888;&#65039;"; label = "Needs attention";
        advice = `Predicted average is <strong>${average.toFixed(1)}%</strong>. Prioritize the weakest subjects, review past mistakes, and build a daily study routine.`;
    }

    element.innerHTML = `<span class="insight-emoji">${emoji}</span> <strong>${label}:</strong> ${advice}`;
}


/* =========================================================
   ATTENDANCE SETUP
========================================================= */

function setupAttendance() {

    if ($("attendanceSemester")) {

        $("attendanceSemester")
            .addEventListener(
                "change",
                () => {

                    renderAttendance();

                    renderOverview();

                }
            );
    }

    if ($("prevMonth")) {

        $("prevMonth").addEventListener(
            "click",
            () => {

                currentCalendarMonth--;

                if (currentCalendarMonth < 0) {
                    currentCalendarMonth = 11;
                    currentCalendarYear--;
                }

                renderAttendance();
            }
        );
    }

    if ($("nextMonth")) {

        $("nextMonth").addEventListener(
            "click",
            () => {

                currentCalendarMonth++;

                if (currentCalendarMonth > 11) {
                    currentCalendarMonth = 0;
                    currentCalendarYear++;
                }

                renderAttendance();
            }
        );
    }
}


/* =========================================================
   ATTENDANCE CALCULATION
========================================================= */

function calculateAttendance(semester) {

    const records =
        allAttendance.filter(
            record =>
                Number(record.semester) ===
                Number(semester)
        );


    let present = 0;
    let absent = 0;
    let leave = 0;


    records.forEach(record => {

        const status =
            String(
                record.status || ""
            ).toLowerCase();


        if (status === "present") {
            present++;
        }

        else if (status === "absent") {
            absent++;
        }

        else if (status === "leave") {
            leave++;
        }

    });


    /*
     * Current system treats every recorded
     * attendance day as a working day.
     */

    const total =
        present +
        absent +
        leave;


    const percentage =
        total === 0
            ? 0
            : (
                present /
                total
            ) * 100;


    return {
        present,
        absent,
        leave,
        total,
        percentage
    };
}

function renderAttendance() {
    const semesterSelect = $("attendanceSemester");
    const semester = semesterSelect ? semesterSelect.value : 1;

    const attendance = calculateAttendance(semester);

    const setText = (id, value) => {
        const element = $(id);
        if (element) element.textContent = value;
    };

    setText(
        "attendancePercentage",
        attendance.total === 0
            ? "--"
            : attendance.percentage.toFixed(1)
    );

    setText("presentDays", attendance.present);
    setText("absentDays", attendance.absent);
    setText("leaveDays", `${attendance.leave} / 4`);

    const ringFill = $("attRingFill");
    if (ringFill) {
        const circumference = 2 * Math.PI * 52;
        const offset = circumference - (attendance.percentage / 100) * circumference;
        ringFill.style.strokeDashoffset = offset;
        ringFill.classList.remove("warning", "danger");
        if (attendance.percentage > 0 && attendance.percentage < 75) ringFill.classList.add("danger");
        else if (attendance.percentage > 0 && attendance.percentage < 85) ringFill.classList.add("warning");
    }

    try { renderAttMonthlyChart(semester); } catch (e) { console.warn("Attendance chart error:", e); }

    renderAttendanceCalendar(
        allAttendance.filter(
            record => Number(record.semester) === Number(semester)
        )
    );

    renderAttendanceWarning(
        attendance.percentage,
        attendance.total
    );
}


/* =========================================================
   RENDER ATTENDANCE CALENDAR
========================================================= */


function renderAttendanceCalendar(records = []) {
    const calendar = document.getElementById("attendanceCalendar");
    const monthLabel = document.getElementById("calendarMonth");

    if (!calendar) return;

    const year = currentCalendarYear;
    const month = currentCalendarMonth;

    if (monthLabel) {
        monthLabel.textContent = new Date(year, month, 1)
            .toLocaleDateString("en-US", {
                month: "long",
                year: "numeric"
            });
    }

    calendar.innerHTML = "";

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const attendanceMap = new Map();

    records.forEach(record => {
        if (!record?.date) return;

        let date = record.date;

        if (typeof date.toDate === "function") {
            date = date.toDate();
        }

        if (date instanceof Date) {
            date = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0"),
                String(date.getDate()).padStart(2, "0")
            ].join("-");
        }

        attendanceMap.set(
            String(date).slice(0, 10),
            String(record.status || "").toLowerCase()
        );
    });

    const today = new Date();
    const todayKey = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day empty";
        calendar.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const status = attendanceMap.get(dateKey) || "neutral";

        const cell = document.createElement("div");
        cell.className = "calendar-day";

        if (status === "present") {
            cell.classList.add("present");
        } else if (status === "absent") {
            cell.classList.add("absent");
        } else if (["od", "on-duty", "on duty", "onduty", "leave"].includes(status)) {
            cell.classList.add("on-duty");
        } else {
            cell.classList.add("neutral");
        }

        if (dateKey === todayKey) {
            cell.classList.add("today");
        }

        cell.textContent = day;
        cell.title = `${dateKey}: ${status}`;
        calendar.appendChild(cell);
    }
}


/* =========================================================
   ATTENDANCE WARNING
========================================================= */

function renderAttendanceWarning(
    percentage,
    total
) {

    const warning =
        $("attendanceWarning");


    if (!warning) {
        return;
    }


    if (total === 0) {

        warning.style.display =
            "none";

        return;
    }


    if (percentage < 65) {

        warning.style.display =
            "block";

        warning.textContent =
            "⚠️ Your attendance is critically low. Please improve your attendance immediately.";

        return;
    }


    if (percentage < 75) {

        warning.style.display =
            "block";

        warning.textContent =
            "⚠️ Your attendance is below the recommended 75%. Please maintain regular attendance.";

        return;
    }


    warning.style.display =
        "none";
}


/* =========================================================
   ATTENDANCE CLASS
========================================================= */

function getAttendanceClass(status) {

    if (status === "present") {
        return "present";
    }

    if (status === "absent") {
        return "absent";
    }

    if (status === "leave") {
        return "leave";
    }

    return "neutral";
}


/* =========================================================
   LEAVE FORM
========================================================= */

function setupLeaveForm() {

    const form =
        $("leaveForm");


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        submitLeaveRequest
    );


    if ($("leaveSemester")) {

        $("leaveSemester")
            .addEventListener(
                "change",
                updateLeaveAllowance
            );
    }


    if ($("leaveDaysInput")) {

        $("leaveDaysInput")
            .addEventListener(
                "input",
                updateLeaveAllowance
            );
    }
}


/* =========================================================
   SUBMIT LEAVE REQUEST
========================================================= */

async function submitLeaveRequest(event) {

    event.preventDefault();


    if (!currentStudent) {

        alert(
            "Student profile is not loaded."
        );

        return;
    }


    const department =
        $("leaveDepartment")?.value.trim();

    const section =
        $("leaveSection")?.value.trim();

    const semester =
        Number(
            $("leaveSemester")?.value
        );

    const leaveDays =
        Number(
            $("leaveDaysInput")?.value
        );

    const reason =
        $("leaveReason")?.value.trim();


    if (
        !department ||
        !section ||
        !semester ||
        !leaveDays ||
        !reason
    ) {

        alert(
            "Please fill in all leave form fields."
        );

        return;
    }


    if (
        leaveDays < 1 ||
        leaveDays > 4
    ) {

        alert(
            "You can request between 1 and 4 leave days."
        );

        return;
    }


    /*
     * Calculate pending + approved
     * leave requests for the selected semester.
     */

    const alreadyUsed =
        calculateLeaveUsed(
            semester
        );


    const remaining =
        4 - alreadyUsed;


    if (leaveDays > remaining) {

        alert(
            `You have only ${remaining} leave day(s) remaining for Semester ${semester}.`
        );

        return;
    }


    const pendingOrApproved =
        allLeaveRequests
            .filter(
                request =>
                    Number(request.semester) ===
                    semester &&
                    (
                        request.status === "pending" ||
                        request.status === "approved"
                    )
            );


    const requestedTotal =
        pendingOrApproved.reduce(
            (sum, request) =>
                sum +
                (
                    Number(
                        request.leaveDays
                    ) || 0
                ),
            0
        );


    if (
        requestedTotal +
        leaveDays >
        4
    ) {

        alert(
            "This request would exceed your maximum 4 leave days for the semester."
        );

        return;
    }


    try {

        const requestRef =
            doc(
                collection(
                    db,
                    "leaveRequests"
                )
            );


        await setDoc(
            requestRef,
            {

                studentUid:
                    currentStudent.uid,

                studentId:
                    currentStudent.studentId,

                studentName:
                    currentStudent.studentName,

                department,

                section,

                semester,

                leaveDays,

                reason,

                status:
                    "pending",

                submittedAt:
                    serverTimestamp(),

                reviewedAt:
                    null,

                reviewedBy:
                    null

            }
        );


        alert(
            "Leave request submitted successfully."
        );


        $("leaveForm").reset();


        if ($("leaveStudentName")) {

            $("leaveStudentName").value =
                currentStudent.studentName;
        }


        const newRequest = {

            studentUid:
                currentStudent.uid,

            studentId:
                currentStudent.studentId,

            studentName:
                currentStudent.studentName,

            department,

            section,

            semester,

            leaveDays,

            reason,

            status:
                "pending",

            submittedAt:
                new Date()

        };


        allLeaveRequests.unshift(
            newRequest
        );


        renderLeaveRequests();

        updateLeaveAllowance();

    } catch (error) {

        console.error(
            "Leave request error:",
            error
        );

        alert(
            "Unable to submit leave request. Please try again."
        );
    }
}


/* =========================================================
   CALCULATE LEAVE USED
========================================================= */

function calculateLeaveUsed(semester) {

    return allLeaveRequests
        .filter(
            request =>
                Number(request.semester) ===
                Number(semester) &&
                (
                    request.status === "pending" ||
                    request.status === "approved"
                )
        )
        .reduce(
            (sum, request) =>
                sum +
                (
                    Number(
                        request.leaveDays
                    ) || 0
                ),
            0
        );
}


/* =========================================================
   UPDATE LEAVE ALLOWANCE
========================================================= */

function updateLeaveAllowance() {

    const semester =
        Number(
            $("leaveSemester")?.value
        );


    if (!semester) {

        setText(
            "leaveRemainingText",
            "Select a semester"
        );

        return;
    }


    const used =
        calculateLeaveUsed(
            semester
        );


    const remaining =
        Math.max(
            0,
            4 - used
        );


    setText(
        "leaveRemainingText",
        `${remaining} day${remaining === 1 ? "" : "s"} remaining`
    );


    if ($("leaveDaysInput")) {

        $("leaveDaysInput").max =
            remaining;

        if (
            Number(
                $("leaveDaysInput").value
            ) > remaining
        ) {

            $("leaveDaysInput").value =
                remaining > 0
                    ? remaining
                    : "";
        }

    }
}


/* =========================================================
   RENDER LEAVE REQUESTS
========================================================= */

function renderLeaveRequests() {

    const tbody =
        $("leaveRequestsBody");


    if (!tbody) {
        return;
    }


    if (allLeaveRequests.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    No leave requests found.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML = "";


    allLeaveRequests.forEach(request => {

        const row =
            document.createElement("tr");


        const status =
            String(
                request.status ||
                "pending"
            ).toLowerCase();


        row.innerHTML = `

            <td>
                Semester ${escapeHTML(
                    request.semester || "--"
                )}
            </td>

            <td>
                ${escapeHTML(
                    request.leaveDays || 0
                )}
            </td>

            <td>
                ${escapeHTML(
                    request.reason || "--"
                )}
            </td>

            <td>
                ${escapeHTML(
                    formatTimestamp(
                        request.submittedAt
                    )
                )}
            </td>

            <td>
                <span class="leave-status ${status}">
                    ${escapeHTML(
                        capitalize(status)
                    )}
                </span>
            </td>

        `;


        tbody.appendChild(row);

    });
}


/* =========================================================
   BUS ROUTES
========================================================= */

function setupBusRoutes() {

    if ($("morningJourneyBtn")) {

        $("morningJourneyBtn")
            .addEventListener(
                "click",
                () => {

                    currentJourney =
                        "morning";

                    updateJourneyButtons();

                    loadBusRoutes();

                }
            );
    }


    if ($("eveningJourneyBtn")) {

        $("eveningJourneyBtn")
            .addEventListener(
                "click",
                () => {

                    currentJourney =
                        "evening";

                    updateJourneyButtons();

                    loadBusRoutes();

                }
            );
    }


    if ($("busStopSelect")) {

        $("busStopSelect")
            .addEventListener(
                "change",
                () => {
                    loadBusRoutes();
                    const selected = $("busStopSelect").value;
                    if (selected) {
                        initializeBusMap();
                        zoomToStop(selected);
                    }
                }
            );
    }


    if ($("busSelect")) {

        $("busSelect")
            .addEventListener(
                "change",
                selectBus
            );
    }

    if ($("availableBuses")) {

        $("availableBuses").addEventListener(
            "click",
            (event) => {

                const card = event.target.closest(
                    ".bus-list-card"
                );

                if (!card) return;

                const busNumber = card.dataset.bus;

                if (!busNumber) return;

                selectedBusNumber = busNumber;

                if ($("busSelect")) {
                    $("busSelect").value = busNumber;
                }

                document.querySelectorAll(".bus-list-card").forEach(c => {
                    c.classList.toggle("selected", c.dataset.bus === busNumber);
                });

                const location = busLocationsCache[busNumber];

                if (location) {
                    updateSelectedBusInfo(location);
                } else {
                    updateSelectedBusInfo({
                        busNumber,
                        isActive: false
                    });
                }

                if (busMarkers[busNumber] && busMap) {
                    busMap.setView(
                        busMarkers[busNumber].getLatLng(),
                        15
                    );
                    busMarkers[busNumber].openPopup();
                }
            }
        );
    }


    updateJourneyButtons();

    loadBusRoutes();
}


/* =========================================================
   JOURNEY BUTTONS
========================================================= */

function updateJourneyButtons() {

    const morning =
        $("morningJourneyBtn");

    const evening =
        $("eveningJourneyBtn");


    if (morning) {

        morning.classList.toggle(
            "active",
            currentJourney === "morning"
        );
    }


    if (evening) {

        evening.classList.toggle(
            "active",
            currentJourney === "evening"
        );
    }
}


/* =========================================================
   INITIALIZE BUS MAP
========================================================= */

function initializeBusMap() {

    if (
        busMap ||
        typeof L === "undefined"
    ) {
        return;
    }


    const mapElement =
        $("busMap");


    if (!mapElement) {
        return;
    }


    /*
     * Default map center.
     * This can be changed to the college location.
     */

    busMap =
        L.map(
            "busMap"
        ).setView(
            [11.0168, 76.9558],
            12
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(busMap);
}


/* =========================================================
   STOP COORDINATES
========================================================= */

const stopCoordinates = {
    "Avadi":                    [13.1067, 80.0970],
    "Maduravoyal":              [13.0604, 80.1596],
    "Anna Nagar West":          [13.0850, 80.2080],
    "West Mambalam":            [13.0382, 80.2224],
    "Red Hills":                [13.1858, 80.1871],
    "Moolakadai":               [13.1488, 80.1990],
    "MKP Nagar":                [13.1230, 80.2150],
    "Villivakkam":              [13.1069, 80.2119],
    "Chindadripet":             [13.0691, 80.2747],
    "Thiruvottiyur":            [13.1615, 80.2989],
    "Royapuram":                [13.1147, 80.2912],
    "Tondiarpet":               [13.1266, 80.2850],
    "Light House":              [13.0388, 80.2789],
    "Broadway":                 [13.0920, 80.2810],
    "Royapettah":               [13.0564, 80.2660],
    "Oragadam":                 [12.8070, 79.9710],
    "Chengalpet":               [12.6919, 79.9770],
    "Perungalathur":            [12.9040, 80.0940],
    "Asthinapuram":             [12.8700, 80.0400],
    "Chrompet":                 [12.9516, 80.1408],
    "Tambaram Gate":            [12.9280, 80.1230],
    "Potheri":                  [12.8230, 80.0440],
    "Camp Road":                [12.8750, 80.0850],
    "Balaji Nagar":             [12.8900, 80.0700],
    "Kozhli Pannai":            [12.8600, 80.0600],
    "Chempakkam":               [12.7700, 80.1600],
    "Puthu Kovil":              [12.7500, 80.1500],
    "Medavakkam":               [12.9188, 80.1922],
    "Medavakkam Koot Road":     [12.9150, 80.1900],
    "Anagaputhur":              [12.9600, 80.1050],
    "Poonamallee":              [13.0474, 80.1045],
    "Porur":                    [13.0354, 80.1563],
    "K.K. Nagar":               [13.0345, 80.2060],
    "K.K. Nagar Depot":         [13.0320, 80.2030],
    "Guindy":                   [13.0067, 80.2206],
    "Tansi Nagar":              [12.9950, 80.2050],
    "Velachery Bypass":         [12.9810, 80.2200],
    "Mogapair":                 [13.0860, 80.1720],
    "K-4 Police Station":       [13.1100, 80.2000],
    "Blue Star":                [13.0480, 80.1690],
    "Metha Nagar":              [13.0500, 80.2350],
    "Valluvar Kottam":          [13.0500, 80.2370],
    "Kaliappa Hospital":        [12.9880, 80.2600],
    "Kodambakkam":              [13.0515, 80.2260],
    "Saidapet":                 [13.0232, 80.2280],
    "Panagal Park":             [13.0408, 80.2340],
    "S.R.P":                    [12.9020, 80.2270],
    "Karapakkam":               [12.9300, 80.2310],
    "N.G.O. Colony":            [12.9540, 80.1540],
    "Nanganallur":              [12.9800, 80.1850],
    "UTI Bank":                 [13.0480, 80.2300],
    "Kumaran Theatre":          [13.0510, 80.2120],
    "Kelkattalai":              [12.9400, 80.1800],
    "Vellakal":                 [12.9200, 80.1600],
    "Balaji Dental Hospital":   [12.9100, 80.2200],
    "Besant Nagar":             [13.0002, 80.2707],
    "Ambika Appalam":           [12.9850, 80.2580],
    "Thiruvanmiyur Signal":     [12.9830, 80.2600],
    "Thiruvanmiyur":            [12.9830, 80.2594],
    "R.M Hospital":             [12.9700, 80.2550],
    "Kottivakkam":              [12.9590, 80.2570],
    "Kalpakkam":                [12.5564, 80.1756],
    "Thirupporur":              [12.7194, 80.1878],
    "Anupuram":                 [12.5550, 80.1700],
    "Navalur":                  [12.8449, 80.2267],
    "Kelambakkam":              [12.7869, 80.2189],
    "T. Nagar":                 [13.0418, 80.2341],
    "CIT Nagar":                [13.0357, 80.2270],
    "Koyambedu":                [13.0694, 80.1948],
    "Vadapalani":               [13.0520, 80.2122],
    "Ramapuram":                [13.0319, 80.1700],
    "Iyyappanthangal":          [13.0509, 80.1288],
    "Tambaram":                 [12.9249, 80.1278],
    "Pallavaram":               [12.9675, 80.1508],
    "Perumbakkam":              [12.9056, 80.2008],
    "Adyar":                    [13.0063, 80.2574]
};

const predefinedRoutes = [
    { busNumber: "11",       stops: ["Avadi"] },
    { busNumber: "12",       stops: ["Maduravoyal", "Anna Nagar West"] },
    { busNumber: "13",       stops: ["West Mambalam"] },
    { busNumber: "21",       stops: ["Red Hills"] },
    { busNumber: "22",       stops: ["Moolakadai"] },
    { busNumber: "23",       stops: ["MKP Nagar"] },
    { busNumber: "24",       stops: ["Villivakkam"] },
    { busNumber: "25",       stops: ["Chindadripet"] },
    { busNumber: "31",       stops: ["Thiruvottiyur"] },
    { busNumber: "31/A",     stops: ["Royapuram"] },
    { busNumber: "32",       stops: ["Tondiarpet"] },
    { busNumber: "33",       stops: ["Light House", "Broadway"] },
    { busNumber: "33A",      stops: ["Light House", "Broadway"] },
    { busNumber: "34",       stops: ["Royapettah"] },
    { busNumber: "40",       stops: ["Oragadam"] },
    { busNumber: "41",       stops: ["Chengalpet", "Perungalathur"] },
    { busNumber: "41/A",     stops: ["Chengalpet", "Perungalathur"] },
    { busNumber: "42",       stops: ["Asthinapuram"] },
    { busNumber: "43",       stops: ["Chrompet"] },
    { busNumber: "44",       stops: ["Tambaram Gate"] },
    { busNumber: "45",       stops: ["Potheri"] },
    { busNumber: "46",       stops: ["Camp Road"] },
    { busNumber: "47",       stops: ["Balaji Nagar", "Kozhli Pannai"] },
    { busNumber: "47A",      stops: ["Balaji Nagar", "Kozhli Pannai"] },
    { busNumber: "48",       stops: ["Chempakkam", "Puthu Kovil"] },
    { busNumber: "48A",      stops: ["Chempakkam", "Puthu Kovil"] },
    { busNumber: "49",       stops: ["Medavakkam", "Medavakkam Koot Road"] },
    { busNumber: "49A",      stops: ["Medavakkam", "Medavakkam Koot Road"] },
    { busNumber: "50",       stops: ["Anagaputhur"] },
    { busNumber: "51",       stops: ["Poonamallee"] },
    { busNumber: "52",       stops: ["Porur"] },
    { busNumber: "53",       stops: ["K.K. Nagar"] },
    { busNumber: "54",       stops: ["Guindy"] },
    { busNumber: "55",       stops: ["Tansi Nagar"] },
    { busNumber: "56",       stops: ["K.K. Nagar Depot"] },
    { busNumber: "57",       stops: ["Velachery Bypass"] },
    { busNumber: "61",       stops: ["Mogapair"] },
    { busNumber: "62",       stops: ["K-4 Police Station"] },
    { busNumber: "63",       stops: ["Blue Star"] },
    { busNumber: "64",       stops: ["Metha Nagar"] },
    { busNumber: "65",       stops: ["Valluvar Kottam"] },
    { busNumber: "67",       stops: ["Kaliappa Hospital"] },
    { busNumber: "71",       stops: ["Kodambakkam"] },
    { busNumber: "72",       stops: ["Saidapet"] },
    { busNumber: "74",       stops: ["Panagal Park"] },
    { busNumber: "77",       stops: ["S.R.P", "Karapakkam"] },
    { busNumber: "77A",      stops: ["S.R.P", "Karapakkam"] },
    { busNumber: "81",       stops: ["N.G.O. Colony"] },
    { busNumber: "82",       stops: ["Nanganallur"] },
    { busNumber: "83",       stops: ["UTI Bank"] },
    { busNumber: "84",       stops: ["Kumaran Theatre"] },
    { busNumber: "85",       stops: ["Kelkattalai", "Vellakal"] },
    { busNumber: "85A",      stops: ["Kelkattalai", "Vellakal"] },
    { busNumber: "86",       stops: ["Balaji Dental Hospital"] },
    { busNumber: "91",       stops: ["Besant Nagar"] },
    { busNumber: "92",       stops: ["Ambika Appalam"] },
    { busNumber: "96",       stops: ["Thiruvanmiyur Signal"] },
    { busNumber: "97",       stops: ["R.M Hospital", "Kottivakkam"] },
    { busNumber: "98",       stops: ["R.M Hospital", "Kottivakkam"] },
    { busNumber: "99",       stops: ["R.M Hospital", "Kottivakkam"] },
    { busNumber: "101",      stops: ["Kalpakkam", "Thirupporur"] },
    { busNumber: "101A",     stops: ["Kalpakkam", "Thirupporur"] },
    { busNumber: "102",      stops: ["Anupuram"] }
];

let stopMarker = null;

function zoomToStop(stopName) {
    if (!busMap || typeof L === "undefined") return;

    const coords = stopCoordinates[stopName];
    if (!coords) return;

    if (stopMarker) {
        busMap.removeLayer(stopMarker);
        stopMarker = null;
    }

    stopMarker = L.marker(coords, {
        icon: L.divIcon({
            html: '<div class="stop-map-icon">📍</div>',
            className: "stop-marker-wrapper",
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30]
        })
    }).addTo(busMap);

    stopMarker.bindPopup(
        `<strong>${escapeHTML(stopName)}</strong><br><span style="font-size:11px;color:#6b7280;">Your stop</span>`
    ).openPopup();

    busMap.setView(coords, 14);
}


/* =========================================================
   LOAD BUS ROUTES
========================================================= */

async function loadBusRoutes() {

    const stopSelect =
        $("busStopSelect");

    const busSelect =
        $("busSelect");

    const availableContainer =
        $("availableBuses");


    if (
        !stopSelect ||
        !busSelect
    ) {
        return;
    }


    try {

        const routesRef =
            collection(
                db,
                "busRoutes"
            );


        const snapshot =
            await getDocs(
                routesRef
            );


        const routes = [];


        snapshot.forEach(docSnap => {

            routes.push({
                id: docSnap.id,
                ...docSnap.data()
            });

        });


        /*
         * Collect all stops for the
         * selected journey.
         */

        const allRoutes = [...predefinedRoutes.map(r => ({
            busNumber: r.busNumber,
            morningStops: r.stops,
            eveningStops: r.stops
        }))];

        const firestoreBusNumbers = new Set();
        routes.forEach(route => {
            firestoreBusNumbers.add(route.busNumber || route.id);
            allRoutes.push(route);
        });

        const stopSet = new Set();

        allRoutes.forEach(route => {
            const stops =
                currentJourney === "morning"
                    ? route.morningStops || route.stops || []
                    : route.eveningStops || route.stops || [];

            stops.forEach(stop => {
                stopSet.add(String(stop));
            });
        });


        const currentStop =
            stopSelect.value;


        stopSelect.innerHTML = `
            <option value="">
                Select your location / stopping
            </option>
        `;


        [...stopSet]
            .sort()
            .forEach(stop => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value = stop;

                option.textContent = stop;

                stopSelect.appendChild(
                    option
                );

            });


        if (
            currentStop &&
            stopSet.has(currentStop)
        ) {

            stopSelect.value =
                currentStop;
        }


        /*
         * Filter buses according to
         * selected stop.
         */

        const selectedStop =
            stopSelect.value;


        const matchingRoutes =
            selectedStop
                ? allRoutes.filter(route => {

                    const stops =
                        currentJourney === "morning"
                            ? route.morningStops || route.stops || []
                            : route.eveningStops || route.stops || [];

                    return stops.some(
                        stop =>
                            String(stop) ===
                            String(selectedStop)
                    );

                })
                : allRoutes;


        busSelect.innerHTML = `
            <option value="">
                Select a bus
            </option>
        `;


        matchingRoutes.forEach(route => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                route.busNumber ||
                route.id;

            option.textContent =
                route.busNumber ||
                route.id;

            busSelect.appendChild(
                option
            );

        });


        if (availableContainer) {

            if (
                matchingRoutes.length ===
                0
            ) {

                availableContainer.innerHTML = `
                    <div class="empty-state">
                        No buses found for this stop.
                    </div>
                `;

            } else {

                availableContainer.innerHTML =
                    matchingRoutes
                        .map(route => `

                            <div
                                class="bus-list-card"
                                data-bus="${escapeHTML(
                                    route.busNumber ||
                                    route.id
                                )}"
                            >

                                <div>

                                    <strong>
                                        Bus ${
                                            escapeHTML(
                                                route.busNumber ||
                                                route.id
                                            )
                                        }
                                    </strong>

                                    <span class="bus-route-stops">
                                        ${
                                            (route.morningStops || route.stops || [])
                                                .map(s => escapeHTML(String(s)))
                                                .join(" · ")
                                        }
                                    </span>

                                    <span>
                                        ${
                                            currentJourney === "morning"
                                                ? "Home → College"
                                                : "College → Drop-off"
                                        }
                                    </span>

                                </div>

                                <div
                                    class="bus-live-status"
                                >
                                    ● Live tracking
                                </div>

                            </div>

                        `)
                        .join("");
            }
        }


        currentMatchingRoutes = matchingRoutes;

        if (selectedStop && matchingRoutes.length > 0) {
            const firstBus = matchingRoutes[0].busNumber || matchingRoutes[0].id;
            busSelect.value = firstBus;
            selectedBusNumber = firstBus;

            document.querySelectorAll(".bus-list-card").forEach(c => {
                c.classList.toggle("selected", c.dataset.bus === firstBus);
            });

            const cached = busLocationsCache[firstBus];
            if (cached) {
                updateSelectedBusInfo(cached);
            } else {
                updateSelectedBusInfo({ busNumber: firstBus, isActive: false });
            }

            if (matchingRoutes.length === 1) {
                busSelect.innerHTML = "";
                const opt = document.createElement("option");
                opt.value = firstBus;
                opt.textContent = firstBus;
                busSelect.appendChild(opt);
                busSelect.value = firstBus;
            }
        } else {
            selectedBusNumber = null;
            if ($("selectedBusInfo")) {
                $("selectedBusInfo").style.display = "none";
            }
        }

        if (
            typeof L !== "undefined"
        ) {

            initializeBusMap();
        }

        startBusLocationListener();

    } catch (error) {

        console.error(
            "Bus route loading error:",
            error
        );

        if (availableContainer) {

            availableContainer.innerHTML = `
                <div class="empty-state">
                    Unable to load bus routes.
                </div>
            `;
        }
    }
}


/* =========================================================
   REAL-TIME BUS LOCATION LISTENER
========================================================= */

function startBusLocationListener() {

    if (busLocationUnsubscribe) {
        busLocationUnsubscribe();
        busLocationUnsubscribe = null;
    }

    const locationRef =
        collection(db, "busLocations");

    busLocationUnsubscribe = onSnapshot(
        locationRef,
        (snapshot) => {

            snapshot.forEach(docSnap => {

                busLocationsCache[docSnap.id] = {
                    id: docSnap.id,
                    ...docSnap.data()
                };

            });

            currentMatchingRoutes.forEach(route => {

                const busNumber =
                    route.busNumber || route.id;

                const location =
                    busLocationsCache[busNumber];

                if (location) {
                    updateBusMarker(location);
                }
            });

            updateBusListStatus();

            if (selectedBusNumber) {

                const selectedLocation =
                    busLocationsCache[selectedBusNumber];

                if (selectedLocation) {
                    updateSelectedBusInfo(selectedLocation);
                }
            }
        },
        (error) => {
            console.error(
                "Bus location listener error:",
                error
            );
        }
    );
}


function stopBusLocationListener() {

    if (busLocationUnsubscribe) {
        busLocationUnsubscribe();
        busLocationUnsubscribe = null;
    }
}


/* =========================================================
   UPDATE BUS LIST CARD STATUS
========================================================= */

function updateBusListStatus() {

    const cards =
        document.querySelectorAll(".bus-list-card");

    cards.forEach(card => {

        const busNumber = card.dataset.bus;

        const location =
            busLocationsCache[busNumber];

        const statusEl =
            card.querySelector(".bus-live-status");

        if (!statusEl) return;

        if (location && location.isActive === true) {

            const ago = getTimeAgo(location.updatedAt);

            statusEl.innerHTML =
                `<span class="bus-status-dot active"></span> Live${ago ? " · " + ago : ""}`;

            statusEl.classList.add("active");
            statusEl.classList.remove("offline");

        } else {

            statusEl.innerHTML =
                `<span class="bus-status-dot"></span> Offline`;

            statusEl.classList.add("offline");
            statusEl.classList.remove("active");
        }
    });
}


function getTimeAgo(timestamp) {

    if (!timestamp) return "";

    const ms = getTimestampMillis(timestamp);

    if (!ms) return "";

    const seconds =
        Math.floor((Date.now() - ms) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

    return "";
}


/* =========================================================
   UPDATE BUS MARKER
========================================================= */

function updateBusMarker(location) {

    if (!busMap || typeof L === "undefined") {
        return;
    }

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return;
    }

    const busNumber = location.busNumber || location.id;
    const driverName = location.driverName || "Unknown";
    const active = location.isActive === true;
    const ago = getTimeAgo(location.updatedAt);

    const popupContent = `
        <div style="font-family:Inter,sans-serif;min-width:140px;">
            <strong style="font-size:14px;">Bus ${escapeHTML(busNumber)}</strong>
            <br>
            <span style="color:#6b7280;font-size:12px;">
                Driver: ${escapeHTML(driverName)}
            </span>
            <br>
            <span style="font-size:11px;color:${active ? '#16a34a' : '#dc2626'};">
                ${active ? "● Active" : "● Offline"}${ago ? " · " + ago : ""}
            </span>
        </div>
    `;

    const busIcon = L.divIcon({
        html: `<div class="bus-map-icon ${active ? "active" : ""}">${escapeHTML(busNumber)}</div>`,
        className: "bus-marker-wrapper",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20]
    });

    if (busMarkers[busNumber]) {

        busMarkers[busNumber].setLatLng([latitude, longitude]);
        busMarkers[busNumber].setIcon(busIcon);
        busMarkers[busNumber].setPopupContent(popupContent);
        return;
    }

    const marker = L.marker(
        [latitude, longitude],
        { icon: busIcon }
    ).addTo(busMap);

    marker.bindPopup(popupContent);

    marker.on("click", () => {

        selectedBusNumber = busNumber;

        if ($("busSelect")) {
            $("busSelect").value = busNumber;
        }

        updateSelectedBusInfo(location);

        document.querySelectorAll(".bus-list-card").forEach(c => {
            c.classList.toggle("selected", c.dataset.bus === busNumber);
        });
    });

    busMarkers[busNumber] = marker;
}


/* =========================================================
   SELECT BUS
========================================================= */

async function selectBus() {

    const busNumber =
        $("busSelect")?.value;

    if (!busNumber) {

        selectedBusNumber = null;

        if ($("selectedBusInfo")) {
            $("selectedBusInfo").style.display = "none";
        }

        document.querySelectorAll(".bus-list-card").forEach(c => {
            c.classList.remove("selected");
        });

        return;
    }

    selectedBusNumber = busNumber;

    document.querySelectorAll(".bus-list-card").forEach(c => {
        c.classList.toggle("selected", c.dataset.bus === busNumber);
    });

    const cached = busLocationsCache[busNumber];

    if (cached) {

        updateSelectedBusInfo(cached);

    } else {

        try {

            const locationSnap =
                await getDoc(
                    doc(db, "busLocations", busNumber)
                );

            if (locationSnap.exists()) {

                const location = {
                    id: locationSnap.id,
                    ...locationSnap.data()
                };

                busLocationsCache[busNumber] = location;
                updateSelectedBusInfo(location);

            } else {

                updateSelectedBusInfo({
                    busNumber,
                    isActive: false
                });
            }

        } catch (error) {

            console.error("Bus selection error:", error);

            updateSelectedBusInfo({
                busNumber,
                isActive: false
            });
        }
    }

    if (busMarkers[busNumber] && busMap) {
        busMap.setView(
            busMarkers[busNumber].getLatLng(),
            15
        );
        busMarkers[busNumber].openPopup();
    }
}


/* =========================================================
   SELECTED BUS INFORMATION
========================================================= */

function updateSelectedBusInfo(location) {

    const info = $("selectedBusInfo");

    if (!info) return;

    info.style.display = "grid";

    setText(
        "selectedBusNumber",
        location.busNumber || selectedBusNumber || "--"
    );

    setText(
        "selectedBusDriver",
        location.driverName || "--"
    );

    const active = location.isActive === true;

    setText(
        "selectedBusStatus",
        active ? "● Live" : "○ Offline"
    );

    const statusEl = $("selectedBusStatus");
    if (statusEl) {
        statusEl.className = active ? "status-live" : "status-offline";
    }

    const lastUpdatedEl = $("selectedBusLastUpdated");
    if (lastUpdatedEl && location.updatedAt) {
        lastUpdatedEl.textContent = "Updated " + getTimeAgo(location.updatedAt);
        lastUpdatedEl.style.display = "block";
    } else if (lastUpdatedEl) {
        lastUpdatedEl.textContent = "";
        lastUpdatedEl.style.display = "none";
    }
}


/* =========================================================
   UTILITY FUNCTIONS
========================================================= */

function setText(
    id,
    value
) {

    const element =
        $(id);

    if (element) {

        element.textContent =
            value;
    }
}


function formatNumber(value) {

    const number =
        Number(value);


    if (
        Number.isNaN(number)
    ) {
        return "--";
    }


    return Number.isInteger(number)
        ? number
        : number.toFixed(1);
}


function formatPercentage(value) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(Number(value))
    ) {
        return "--";
    }


    return `${Number(value).toFixed(1)}%`;
}


function formatPercentageBar(value) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(Number(value))
    ) {
        return "--";
    }

    const num = Number(value);

    return `<div class="percentage-cell">
        <div class="progress-bar">
            <div
                class="progress-bar-fill ${getBarClass(num)}"
                style="width: ${Math.min(num, 100)}%"
            ></div>
        </div>
        <span class="percentage-text">${num.toFixed(1)}%</span>
    </div>`;
}


function capitalize(value) {

    if (!value) {
        return "";
    }


    return value.charAt(0).toUpperCase() +
        value.slice(1);
}


function formatDate(dateString) {

    if (!dateString) {
        return "--";
    }


    const date =
        new Date(
            `${dateString}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return dateString;
    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


function formatTimestamp(timestamp) {

    const milliseconds =
        getTimestampMillis(
            timestamp
        );


    if (!milliseconds) {
        return "--";
    }


    return new Date(
        milliseconds
    ).toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================================================
   ATTENDANCE MONTHLY CHART
========================================================= */

function renderAttMonthlyChart(semester) {
    const canvas = document.getElementById("attMonthlyChart");
    if (!canvas || typeof Chart === "undefined") return;

    destroyChart("attMonthly");

    const records = allAttendance.filter(r => Number(r.semester) === Number(semester));
    const months = {};

    records.forEach(r => {
        let d = r.date;
        if (d && typeof d.toDate === "function") d = d.toDate();
        else if (typeof d === "string") d = new Date(d);
        if (!(d instanceof Date) || isNaN(d)) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!months[key]) months[key] = { present: 0, total: 0 };
        months[key].total++;
        if (String(r.status || "").toLowerCase() === "present") months[key].present++;
    });

    const sorted = Object.keys(months).sort();
    if (sorted.length === 0) return;

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const colors = getChartColors();

    const labels = sorted.map(key => monthNames[parseInt(key.split("-")[1]) - 1]);
    const data = sorted.map(key => {
        const m = months[key];
        return m.total > 0 ? Math.round((m.present / m.total) * 1000) / 10 : 0;
    });

    const barColors = data.map(v => v < 75 ? "rgba(220, 38, 38, 0.7)" : v < 85 ? "rgba(234, 88, 12, 0.7)" : "rgba(22, 163, 74, 0.7)");
    const borderColors = data.map(v => v < 75 ? "#dc2626" : v < 85 ? "#ea580c" : "#16a34a");

    chartInstances.attMonthly = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Attendance %",
                data,
                backgroundColor: barColors,
                borderColor: borderColors,
                borderWidth: 1,
                borderRadius: 6,
                maxBarThickness: 36
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: colors.bg,
                    titleColor: colors.text,
                    bodyColor: colors.text,
                    borderColor: colors.grid,
                    borderWidth: 1,
                    callbacks: { label: ctx => `Attendance: ${ctx.parsed.y}%` }
                }
            },
            scales: {
                y: {
                    min: 0, max: 100,
                    ticks: { color: colors.muted, stepSize: 25, callback: v => v + "%", font: { size: 10 } },
                    grid: { color: colors.grid }
                },
                x: {
                    ticks: { color: colors.muted, font: { size: 10 } },
                    grid: { display: false }
                }
            }
        }
    });
}


/* =========================================================
   NOTIFICATIONS & TOASTS
========================================================= */

let notifications = [];

function showToast(message, type) {
    type = type || "info";
    const container = $("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast " + type;
    const icons = { success: "✅", error: "❌", info: "ℹ️" };
    toast.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>'
        + '<span>' + escapeHTML(message) + '</span>'
        + '<button class="toast-close" onclick="this.parentElement.remove()">✕</button>';
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "toastSlideOut 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function addNotification(message, type) {
    type = type || "info";
    notifications.unshift({ id: Date.now(), message, type, time: new Date(), read: false });
    updateNotifUI();
    showToast(message, type);
}

function updateNotifUI() {
    const countEl = $("notifCount");
    const listEl = $("notifList");
    if (!countEl || !listEl) return;

    const unread = notifications.filter(n => !n.read).length;
    countEl.textContent = unread > 9 ? "9+" : unread;
    countEl.style.display = unread > 0 ? "flex" : "none";

    if (notifications.length === 0) {
        listEl.innerHTML = '<div class="notif-empty">No notifications</div>';
        return;
    }

    listEl.innerHTML = notifications.slice(0, 20).map(n => {
        const sec = Math.floor((new Date() - n.time) / 1000);
        let ago = "Just now";
        if (sec >= 86400) ago = Math.floor(sec / 86400) + "d ago";
        else if (sec >= 3600) ago = Math.floor(sec / 3600) + "h ago";
        else if (sec >= 60) ago = Math.floor(sec / 60) + "m ago";
        return '<div class="notif-item ' + (n.read ? "" : "unread") + '">'
            + '<div>' + escapeHTML(n.message) + '</div>'
            + '<div class="notif-item-time">' + ago + '</div></div>';
    }).join("");
}

function setupNotifications() {
    const bell = $("notifBell");
    const dropdown = $("notifDropdown");
    const clearAll = $("notifClearAll");

    if (bell && dropdown) {
        bell.addEventListener("click", (e) => {
            e.stopPropagation();
            const visible = dropdown.style.display !== "none";
            dropdown.style.display = visible ? "none" : "block";
            if (!visible) {
                notifications.forEach(n => n.read = true);
                updateNotifUI();
            }
        });
        document.addEventListener("click", (e) => {
            if (!dropdown.contains(e.target) && e.target !== bell) {
                dropdown.style.display = "none";
            }
        });
    }

    if (clearAll) {
        clearAll.addEventListener("click", () => {
            notifications = [];
            updateNotifUI();
        });
    }
}

function checkLeaveNotifications() {
    const reviewed = allLeaveRequests.filter(r =>
        (r.status === "approved" || r.status === "rejected") && r.reviewedAt
    );
    const notifiedKey = "studenttrack-notified-" + (currentUser?.uid || "");
    const alreadyNotified = JSON.parse(localStorage.getItem(notifiedKey) || "[]");

    reviewed.forEach(r => {
        if (!alreadyNotified.includes(r.id)) {
            const action = r.status === "approved" ? "approved" : "rejected";
            const type = r.status === "approved" ? "success" : "error";
            addNotification("Your leave request has been " + action + " by the counsellor.", type);
            alreadyNotified.push(r.id);
        }
    });

    localStorage.setItem(notifiedKey, JSON.stringify(alreadyNotified));
}


/* =========================================================
   PDF EXPORT
========================================================= */

function exportPerformancePDF() {
    if (typeof window.jspdf === "undefined") {
        alert("PDF library is still loading. Please try again in a moment.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const name = currentStudent?.studentName || currentStudent?.name || "Student";
    const id = currentStudent?.studentId || "--";
    const semester = $("performanceSemester")?.value || "1";
    let y = 20;

    pdf.setFontSize(20);
    pdf.setTextColor(37, 99, 235);
    pdf.text("StudentTrack - Performance Report", 105, y, { align: "center" });
    y += 12;

    pdf.setFontSize(11);
    pdf.setTextColor(100);
    pdf.text("Generated on " + new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }), 105, y, { align: "center" });
    y += 14;

    pdf.setFontSize(12);
    pdf.setTextColor(0);
    pdf.text("Student: " + name, 14, y);
    pdf.text("ID: " + id, 120, y);
    y += 7;
    pdf.text("Semester: " + semester, 14, y);
    y += 12;

    pdf.setDrawColor(200);
    pdf.line(14, y, 196, y);
    y += 10;

    const gpaText = $("predictedGPA")?.textContent || "--";
    pdf.setFontSize(14);
    pdf.setTextColor(37, 99, 235);
    pdf.text("Predicted GPA: " + gpaText + " / 10", 14, y);
    y += 12;

    pdf.setFontSize(13);
    pdf.setTextColor(0);
    pdf.text("Subject-wise Predictions", 14, y);
    y += 8;

    const marks = getLatestMarkRecords(allMarks.filter(m => Number(m.semester) === Number(semester)));
    const subjectGroups = groupMarksBySubject(marks);
    const predictions = calculateSubjectPredictions(subjectGroups);

    pdf.setFontSize(10);
    predictions.forEach(item => {
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.setTextColor(0);
        pdf.text(item.subject, 14, y);
        let details = [];
        if (item.model1 !== null) details.push("M1: " + item.model1.toFixed(1) + "%");
        if (item.model2 !== null) details.push("M2: " + item.model2.toFixed(1) + "%");
        if (item.model3 !== null) details.push("M3: " + item.model3.toFixed(1) + "%");
        if (item.predicted !== null) {
            if (item.predicted >= 70) pdf.setTextColor(22, 163, 74);
            else pdf.setTextColor(220, 38, 38);
            details.push("Predicted: " + item.predicted.toFixed(1) + "%");
        }
        pdf.text(details.join("  |  "), 70, y);
        y += 7;
    });

    y += 6;
    if (y > 260) { pdf.addPage(); y = 20; }

    pdf.setFontSize(13);
    pdf.setTextColor(0);
    pdf.text("Recommendations", 14, y);
    y += 8;

    pdf.setFontSize(10);
    const recContainer = $("recommendations");
    if (recContainer) {
        const recItems = recContainer.querySelectorAll(".recommendation-item");
        recItems.forEach(item => {
            if (y > 270) { pdf.addPage(); y = 20; }
            const text = item.textContent.trim().replace(/\s+/g, " ");
            const lines = pdf.splitTextToSize(text, 170);
            pdf.setTextColor(60);
            pdf.text(lines, 18, y);
            y += lines.length * 5 + 3;
        });
    }

    y += 6;
    if (y > 270) { pdf.addPage(); y = 20; }
    pdf.setDrawColor(200);
    pdf.line(14, y, 196, y);
    y += 8;
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    pdf.text("This report was generated by StudentTrack CGPA Predictor.", 105, y, { align: "center" });

    pdf.save("StudentTrack_Report_Sem" + semester + "_" + name.replace(/\s+/g, "_") + ".pdf");
}
