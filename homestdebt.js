/* =========================================================
   FIREBASE IMPORTS
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {

    apiKey: "AIzaSyByRLQj6i2c2GhM21-cmRkSISbIVbfyZQU",

    authDomain:
        "student-progress-tracker-33064.firebaseapp.com",

    projectId:
        "student-progress-tracker-33064",

    storageBucket:
        "student-progress-tracker-33064.firebasestorage.app",

    messagingSenderId:
        "549690484739",

    appId:
        "1:549690484739:web:903b227ae9d9a238ae8636",

    measurementId:
        "G-30WQXGEKT8"
};


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let currentUser = null;

let studentData = null;

let allMarks = [];


/* =========================================================
   BUS VARIABLES
========================================================= */

let busRoutes = [];

let busLocations = {};

let currentDirection = "morning";

let selectedBusStop = "";

let selectedBusNumber = null;

let busMap = null;

let busMarkers = {};

let routeUnsubscribe = null;

let locationUnsubscribe = null;


/* =========================================================
   AUTHENTICATION
========================================================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "login.html";

        return;
    }


    currentUser = user;


    try {

        await loadStudentProfile();

        await loadStudentMarks();

        initializeBusSystem();

    }

    catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

        alert(
            "Unable to load your dashboard. Please try again."
        );
    }

});


/* =========================================================
   LOAD STUDENT PROFILE
========================================================= */

async function loadStudentProfile() {

    const studentRef =
        doc(db, "students", currentUser.uid);

    const studentSnap =
        await getDoc(studentRef);


    if (!studentSnap.exists()) {

        alert(
            "Student profile not found."
        );

        await signOut(auth);

        window.location.href = "login.html";

        return;
    }


    studentData = studentSnap.data();


    const name =
        studentData.studentName || "Student";

    const id =
        studentData.studentId || "-";

    const email =
        studentData.email ||
        currentUser.email ||
        "-";


    /* Top profile */

    document.getElementById(
        "topStudentName"
    ).textContent = name;


    document.getElementById(
        "topStudentId"
    ).textContent = id;


    document.getElementById(
        "welcomeStudentName"
    ).textContent = name;


    /* Information card */

    document.getElementById(
        "studentName"
    ).textContent = name;


    document.getElementById(
        "studentId"
    ).textContent = id;


    document.getElementById(
        "studentEmail"
    ).textContent = email;


    /* Avatar */

    const firstLetter =
        name.charAt(0).toUpperCase();


    document.getElementById(
        "profileAvatar"
    ).textContent = firstLetter;

}


/* =========================================================
   LOAD STUDENT MARKS
========================================================= */

async function loadStudentMarks() {

    if (!studentData) return;


    const marksRef =
        collection(db, "marks");


    const marksQuery =
        query(
            marksRef,
            where(
                "studentId",
                "==",
                studentData.studentId
            )
        );


    const marksSnapshot =
        await getDocs(marksQuery);


    allMarks = [];


    marksSnapshot.forEach((document) => {

        allMarks.push({

            id: document.id,

            ...document.data()

        });

    });


    renderOverview();

    renderMarksTable();

    runPerformanceAnalysis();

}


/* =========================================================
   TAB HANDLING
========================================================= */

const navItems =
    document.querySelectorAll(".nav-item");


navItems.forEach((button) => {

    button.addEventListener("click", () => {

        const tab =
            button.dataset.tab;


        navItems.forEach((item) => {

            item.classList.remove("active");

        });


        button.classList.add("active");


        document
            .querySelectorAll(".tab-content")
            .forEach((section) => {

                section.classList.remove("active");

            });


        if (tab === "overview") {

            document
                .getElementById("overviewTab")
                .classList.add("active");

        }


        else if (tab === "marks") {

            document
                .getElementById("marksTab")
                .classList.add("active");

        }


        else if (tab === "analysis") {

            document
                .getElementById("analysisTab")
                .classList.add("active");

            runPerformanceAnalysis();

        }


        else if (tab === "bus") {

            document
                .getElementById("busTab")
                .classList.add("active");

            setTimeout(() => {

                if (busMap) {

                    busMap.invalidateSize();

                }

            }, 100);

        }

    });

});


/* =========================================================
   OVERVIEW
========================================================= */

function renderOverview() {

    if (!allMarks.length) {

        document.getElementById(
            "totalExams"
        ).textContent = "0";


        document.getElementById(
            "totalSubjects"
        ).textContent = "0";


        document.getElementById(
            "overallAverage"
        ).textContent = "0%";


        document.getElementById(
            "bestSubject"
        ).textContent = "-";


        document.getElementById(
            "overviewTableBody"
        ).innerHTML = `

            <tr>
                <td colspan="3" class="empty-cell">
                    No marks available yet.
                </td>
            </tr>

        `;

        return;
    }


    const examKeys = new Set();

    const subjectMap = {};


    allMarks.forEach((mark) => {

        const semester =
            mark.semester || "-";

        const exam =
            mark.exam || "-";

        examKeys.add(
            `${semester}-${exam}`
        );


        const subject =
            mark.subject || "Unknown";


        const percentage =
            calculatePercentage(mark);


        if (!subjectMap[subject]) {

            subjectMap[subject] = [];

        }


        subjectMap[subject].push(
            percentage
        );

    });


    const subjectAverages = Object.entries(
        subjectMap
    ).map(([subject, values]) => {

        return {

            subject,

            average:
                averageArray(values)

        };

    });


    const overallAverage =
        averageArray(
            allMarks.map(calculatePercentage)
        );


    const best =
        [...subjectAverages]
            .sort(
                (a, b) =>
                    b.average - a.average
            )[0];


    document.getElementById(
        "totalExams"
    ).textContent =
        examKeys.size;


    document.getElementById(
        "totalSubjects"
    ).textContent =
        subjectAverages.length;


    document.getElementById(
        "overallAverage"
    ).textContent =
        `${overallAverage.toFixed(1)}%`;


    document.getElementById(
        "bestSubject"
    ).textContent =
        best ? best.subject : "-";


    const body =
        document.getElementById(
            "overviewTableBody"
        );


    body.innerHTML = "";


    subjectAverages
        .sort(
            (a, b) =>
                b.average - a.average
        )
        .forEach((item) => {

            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>
                    <strong>
                        ${escapeHTML(item.subject)}
                    </strong>
                </td>

                <td>
                    ${item.average.toFixed(1)}%
                </td>

                <td>
                    ${getStatusBadge(item.average)}
                </td>

            `;


            body.appendChild(row);

        });

}


/* =========================================================
   MARKS TABLE
========================================================= */

function renderMarksTable() {

    const body =
        document.getElementById(
            "marksTableBody"
        );


    const semesterFilter =
        document.getElementById(
            "semesterFilter"
        ).value;


    const examFilter =
        document.getElementById(
            "examFilter"
        ).value;


    let filtered =
        [...allMarks];


    if (semesterFilter !== "all") {

        filtered =
            filtered.filter(
                (mark) =>
                    String(mark.semester) ===
                    semesterFilter
            );

    }


    if (examFilter !== "all") {

        filtered =
            filtered.filter(
                (mark) =>
                    getModelExamId(mark) ===
                    Number(examFilter)
            );

    }


    if (!filtered.length) {

        body.innerHTML = `

            <tr>
                <td colspan="6" class="empty-cell">
                    No marks found.
                </td>
            </tr>

        `;

        return;
    }


    filtered.sort((a, b) => {

        return (
            Number(a.semester || 0) -
            Number(b.semester || 0)
        );

    });


    body.innerHTML = "";


    filtered.forEach((mark) => {

        const percentage =
            calculatePercentage(mark);


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                Semester ${escapeHTML(
                    String(mark.semester || "-")
                )}
            </td>

            <td>
                Model Exam ${getModelExamId(mark) || "-"}
            </td>

            <td>
                ${escapeHTML(
                    mark.subject || "-"
                )}
            </td>

            <td>
                <strong>
                    ${mark.marks ?? 0}
                </strong>
                / ${mark.maxMarks ?? 100}
            </td>

            <td>
                ${percentage.toFixed(1)}%
            </td>

            <td>
                ${getStatusBadge(percentage)}
            </td>

        `;


        body.appendChild(row);

    });

}


/* Filters */

document.getElementById(
    "semesterFilter"
).addEventListener(
    "change",
    renderMarksTable
);


document.getElementById(
    "examFilter"
).addEventListener(
    "change",
    renderMarksTable
);


/* =========================================================
   PERFORMANCE ANALYSIS
========================================================= */

document.getElementById(
    "analysisSemester"
).addEventListener(
    "change",
    runPerformanceAnalysis
);


document.getElementById(
    "semesterMaxMarks"
).addEventListener(
    "input",
    runPerformanceAnalysis
);


/* =========================================================
   RUN PERFORMANCE ANALYSIS
========================================================= */

function runPerformanceAnalysis() {

    if (!allMarks.length) {

        clearAnalysis();

        return;
    }


    const semester =
        Number(
            document.getElementById(
                "analysisSemester"
            ).value
        );


    const semesterMarks =
        allMarks.filter(
            (mark) =>
                Number(mark.semester) ===
                semester
        );


    if (!semesterMarks.length) {

        clearAnalysis();

        return;
    }


    const subjectData =
        getLatestModelMarks(
            semesterMarks
        );


    const prediction =
        calculateWeightedPrediction(
            subjectData
        );


    renderPredictionSummary(
        prediction
    );


    renderPredictionTable(
        prediction
    );


    const trend =
        calculateTrend(
            subjectData
        );


    renderTrend(trend);


    renderPriorityAreas(
        prediction
    );


    renderRecommendations(
        prediction,
        trend
    );


    renderOverallInsight(
        prediction,
        trend
    );

}


/* =========================================================
   GET LATEST MODEL MARKS
========================================================= */

function getLatestModelMarks(
    semesterMarks
) {

    const subjectData = {};


    semesterMarks.forEach((mark) => {

        const subject =
            mark.subject || "Unknown";


        const examId =
            getModelExamId(mark);


        if (!examId) return;


        if (!subjectData[subject]) {

            subjectData[subject] = {};

        }


        const existing =
            subjectData[subject][examId];


        if (
            !existing ||
            getTimestampMillis(mark.uploadedAt) >
            getTimestampMillis(existing.uploadedAt)
        ) {

            subjectData[subject][examId] =
                mark;

        }

    });


    return subjectData;

}


/* =========================================================
   WEIGHTED PREDICTION
========================================================= */

function calculateWeightedPrediction(
    subjectData
) {

    const weights = {

        1: 0.20,

        2: 0.30,

        3: 0.50

    };


    const subjects = Object.keys(
        subjectData
    );


    const result = {

        subjects: [],

        overallPrediction: 0,

        modelsUsed: new Set(),

        strongest: null,

        weakest: null

    };


    subjects.forEach((subject) => {

        const exams =
            subjectData[subject];


        let weightedTotal = 0;

        let availableWeight = 0;

        const modelPercentages = {

            1: null,

            2: null,

            3: null

        };


        [1, 2, 3].forEach((model) => {

            const mark =
                exams[model];


            if (!mark) return;


            const percentage =
                calculatePercentage(mark);


            modelPercentages[model] =
                percentage;


            result.modelsUsed.add(
                model
            );


            weightedTotal +=
                percentage *
                weights[model];


            availableWeight +=
                weights[model];

        });


        let prediction = 0;


        if (availableWeight > 0) {

            prediction =
                weightedTotal /
                availableWeight;

        }


        result.subjects.push({

            subject,

            model1:
                modelPercentages[1],

            model2:
                modelPercentages[2],

            model3:
                modelPercentages[3],

            prediction

        });

    });


    if (result.subjects.length) {

        result.overallPrediction =
            averageArray(
                result.subjects.map(
                    (item) =>
                        item.prediction
                )
            );


        result.subjects.sort(
            (a, b) =>
                b.prediction -
                a.prediction
        );


        result.strongest =
            result.subjects[0];


        result.weakest =
            result.subjects[
                result.subjects.length - 1
            ];

    }


    return result;

}


/* =========================================================
   RENDER PREDICTION SUMMARY
========================================================= */

function renderPredictionSummary(
    prediction
) {

    const maxMarks =
        Number(
            document.getElementById(
                "semesterMaxMarks"
            ).value
        ) || 100;


    const percentage =
        prediction.overallPrediction;


    const predictedScore =
        (
            percentage *
            maxMarks /
            100
        );


    document.getElementById(
        "predictedScore"
    ).textContent =
        predictedScore.toFixed(1);


    document.getElementById(
        "predictedScoreText"
    ).textContent =
        `/ ${maxMarks}`;


    document.getElementById(
        "predictionProgress"
    ).style.width =
        `${Math.min(
            percentage,
            100
        )}%`;


    document.getElementById(
        "modelsUsed"
    ).textContent =
        `${prediction.modelsUsed.size} / 3`;


    if (prediction.strongest) {

        document.getElementById(
            "strongestSubject"
        ).textContent =
            prediction.strongest.subject;


        document.getElementById(
            "strongestSubjectScore"
        ).textContent =
            `${prediction.strongest.prediction.toFixed(1)}% predicted`;

    }

    else {

        document.getElementById(
            "strongestSubject"
        ).textContent = "-";


        document.getElementById(
            "strongestSubjectScore"
        ).textContent = "-";

    }


    if (prediction.weakest) {

        document.getElementById(
            "weakestSubject"
        ).textContent =
            prediction.weakest.subject;


        document.getElementById(
            "weakestSubjectScore"
        ).textContent =
            `${prediction.weakest.prediction.toFixed(1)}% predicted`;

    }

    else {

        document.getElementById(
            "weakestSubject"
        ).textContent = "-";


        document.getElementById(
            "weakestSubjectScore"
        ).textContent = "-";

    }

}


/* =========================================================
   PREDICTION TABLE
========================================================= */

function renderPredictionTable(
    prediction
) {

    const body =
        document.getElementById(
            "predictionTableBody"
        );


    if (!prediction.subjects.length) {

        body.innerHTML = `

            <tr>
                <td colspan="6" class="empty-cell">
                    No model examination data available.
                </td>
            </tr>

        `;

        return;
    }


    body.innerHTML = "";


    prediction.subjects.forEach(
        (item) => {

            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>
                    <strong>
                        ${escapeHTML(item.subject)}
                    </strong>
                </td>

                <td>
                    ${formatNullable(
                        item.model1
                    )}
                </td>

                <td>
                    ${formatNullable(
                        item.model2
                    )}
                </td>

                <td>
                    ${formatNullable(
                        item.model3
                    )}
                </td>

                <td>
                    <strong>
                        ${item.prediction.toFixed(1)}%
                    </strong>
                </td>

                <td>
                    ${getStatusBadge(
                        item.prediction
                    )}
                </td>

            `;


            body.appendChild(row);

        }
    );

}


/* =========================================================
   TREND
========================================================= */

function calculateTrend(
    subjectData
) {

    const firstScores = [];

    const lastScores = [];


    Object.values(subjectData)
        .forEach((exams) => {

            if (exams[1]) {

                firstScores.push(
                    calculatePercentage(
                        exams[1]
                    )
                );

            }


            if (exams[3]) {

                lastScores.push(
                    calculatePercentage(
                        exams[3]
                    )
                );

            }

        });


    if (
        !firstScores.length ||
        !lastScores.length
    ) {

        return {

            type: "insufficient",

            difference: 0

        };

    }


    const firstAverage =
        averageArray(firstScores);


    const lastAverage =
        averageArray(lastScores);


    const difference =
        lastAverage -
        firstAverage;


    if (difference >= 5) {

        return {

            type: "improving",

            difference

        };

    }


    if (difference <= -5) {

        return {

            type: "falling",

            difference

        };

    }


    return {

        type: "stable",

        difference

    };

}


/* =========================================================
   RENDER TREND
========================================================= */

function renderTrend(trend) {

    const box =
        document.getElementById(
            "trendBox"
        );


    if (trend.type === "improving") {

        box.innerHTML = `
            📈 Your performance is improving.
            Your average increased by
            <strong>
                ${trend.difference.toFixed(1)}
                percentage points
            </strong>
            from Model 1 to Model 3.
        `;

    }


    else if (trend.type === "falling") {

        box.innerHTML = `
            📉 Your performance is falling.
            Your average decreased by
            <strong>
                ${Math.abs(
                    trend.difference
                ).toFixed(1)}
                percentage points
            </strong>
            from Model 1 to Model 3.
        `;

    }


    else if (trend.type === "stable") {

        box.innerHTML = `
            ➡️ Your performance is relatively stable.
            The change between Model 1 and Model 3 is
            <strong>
                ${trend.difference.toFixed(1)}
                percentage points
            </strong>.
        `;

    }


    else {

        box.innerHTML = `
            Not enough model examination data
            to calculate a trend.
        `;

    }

}


/* =========================================================
   PRIORITY AREAS
========================================================= */

function renderPriorityAreas(
    prediction
) {

    const container =
        document.getElementById(
            "priorityAreas"
        );


    const prioritySubjects =
        prediction.subjects
            .filter(
                (item) =>
                    item.prediction < 70
            )
            .sort(
                (a, b) =>
                    a.prediction -
                    b.prediction
            )
            .slice(0, 5);


    if (!prioritySubjects.length) {

        container.innerHTML = `

            <p class="muted">
                No high-priority subjects.
                Keep maintaining your current performance.
            </p>

        `;

        return;
    }


    container.innerHTML = "";


    prioritySubjects.forEach(
        (item) => {

            const div =
                document.createElement("div");


            div.className =
                "priority-item";


            div.innerHTML = `

                <strong>
                    ${escapeHTML(item.subject)}
                </strong>

                <span>
                    Predicted performance:
                    ${item.prediction.toFixed(1)}%
                </span>

            `;


            container.appendChild(div);

        }
    );

}


/* =========================================================
   RECOMMENDATIONS
========================================================= */

function renderRecommendations(
    prediction,
    trend
) {

    const container =
        document.getElementById(
            "recommendations"
        );


    const recommendations = [];


    if (prediction.weakest) {

        recommendations.push(
            `Give extra study time to
            <strong>${escapeHTML(
                prediction.weakest.subject
            )}</strong>,
            which currently has the lowest predicted score.`
        );

    }


    if (
        prediction.overallPrediction < 50
    ) {

        recommendations.push(
            "Focus on understanding the fundamentals of every subject and practice questions regularly."
        );

    }

    else if (
        prediction.overallPrediction < 70
    ) {

        recommendations.push(
            "Increase revision frequency and solve more model questions before the semester examination."
        );

    }

    else {

        recommendations.push(
            "Your overall predicted performance is good. Focus on maintaining consistency."
        );

    }


    if (trend.type === "falling") {

        recommendations.push(
            "Your recent performance is falling. Review mistakes from your latest model examination."
        );

    }


    else if (
        trend.type === "improving"
    ) {

        recommendations.push(
            "Your performance is improving. Continue the study strategy that is working for you."
        );

    }


    container.innerHTML = "";


    recommendations.forEach(
        (recommendation) => {

            const div =
                document.createElement("div");


            div.className =
                "recommendation-item";


            div.innerHTML =
                `💡 ${recommendation}`;


            container.appendChild(div);

        }
    );

}


/* =========================================================
   OVERALL INSIGHT
========================================================= */

function renderOverallInsight(
    prediction,
    trend
) {

    const box =
        document.getElementById(
            "overallInsight"
        );


    const score =
        prediction.overallPrediction;


    let message = "";


    if (score >= 80) {

        message =
            "Your predicted performance is excellent. Continue maintaining consistency across all subjects.";

    }

    else if (score >= 70) {

        message =
            "Your predicted performance is good. A little more attention to weaker subjects can improve your semester result.";

    }

    else if (score >= 50) {

        message =
            "Your predicted performance is moderate. Focus especially on the subjects marked as priority areas.";

    }

    else {

        message =
            "Your current predicted performance needs significant improvement. Start with the lowest-scoring subjects and build a consistent revision schedule.";

    }


    box.innerHTML = `

        <strong>
            Overall Insight
        </strong>

        <br>

        ${message}

    `;

}


/* =========================================================
   CLEAR ANALYSIS
========================================================= */

function clearAnalysis() {

    document.getElementById(
        "predictedScore"
    ).textContent = "0";


    document.getElementById(
        "predictedScoreText"
    ).textContent = "/ 100";


    document.getElementById(
        "predictionProgress"
    ).style.width = "0%";


    document.getElementById(
        "modelsUsed"
    ).textContent = "0 / 3";


    document.getElementById(
        "strongestSubject"
    ).textContent = "-";


    document.getElementById(
        "weakestSubject"
    ).textContent = "-";


    document.getElementById(
        "strongestSubjectScore"
    ).textContent = "-";


    document.getElementById(
        "weakestSubjectScore"
    ).textContent = "-";


    document.getElementById(
        "predictionTableBody"
    ).innerHTML = `

        <tr>
            <td colspan="6" class="empty-cell">
                No model examination data available
                for this semester.
            </td>
        </tr>

    `;


    document.getElementById(
        "trendBox"
    ).textContent =
        "Not enough data";


    document.getElementById(
        "priorityAreas"
    ).innerHTML = `

        <p class="muted">
            No priority areas yet.
        </p>

    `;


    document.getElementById(
        "recommendations"
    ).innerHTML = `

        <p class="muted">
            Complete model examinations
            to receive recommendations.
        </p>

    `;


    document.getElementById(
        "overallInsight"
    ).textContent =
        "Performance analysis will appear here.";

}


/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function calculatePercentage(mark) {

    if (
        mark.percentage !== undefined &&
        mark.percentage !== null
    ) {

        return Number(mark.percentage);

    }


    const marks =
        Number(mark.marks || 0);


    const max =
        Number(mark.maxMarks || 100);


    if (!max) return 0;


    return (
        marks /
        max *
        100
    );

}


function averageArray(values) {

    if (!values.length) return 0;


    return (
        values.reduce(
            (sum, value) =>
                sum + Number(value || 0),
            0
        ) /
        values.length
    );

}


function getModelExamId(mark) {

    if (
        mark.examId !== undefined &&
        mark.examId !== null &&
        mark.examId !== ""
    ) {

        const number =
            Number(mark.examId);


        if (
            number === 1 ||
            number === 2 ||
            number === 3
        ) {

            return number;

        }

    }


    const exam =
        String(
            mark.exam || ""
        ).toLowerCase();


    if (
        exam.includes("1")
    ) return 1;


    if (
        exam.includes("2")
    ) return 2;


    if (
        exam.includes("3")
    ) return 3;


    return null;

}


function getStatus(value) {

    if (value < 50) {

        return "High Priority";

    }


    if (value < 70) {

        return "Needs Attention";

    }


    if (value < 80) {

        return "Moderate";

    }


    return "Good";

}


function getStatusBadge(value) {

    let className =
        "status-good";


    if (value < 50) {

        className =
            "status-priority";

    }

    else if (value < 70) {

        className =
            "status-attention";

    }

    else if (value < 80) {

        className =
            "status-moderate";

    }


    return `

        <span class="status-badge ${className}">
            ${getStatus(value)}
        </span>

    `;

}


function formatNullable(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "-";

    }


    return `${Number(value).toFixed(1)}%`;

}


function getTimestampMillis(timestamp) {

    if (!timestamp) return 0;


    if (
        typeof timestamp.toMillis ===
        "function"
    ) {

        return timestamp.toMillis();

    }


    if (
        timestamp.seconds !== undefined
    ) {

        return timestamp.seconds * 1000;

    }


    return 0;

}


function escapeHTML(value) {

    const div =
        document.createElement("div");


    div.textContent =
        String(value ?? "");


    return div.innerHTML;

}


/* =========================================================
   BUS ROUTES SYSTEM
========================================================= */

function initializeBusSystem() {

    initializeBusMap();

    listenForBusRoutes();

    listenForBusLocations();

    setupBusControls();

}


/* =========================================================
   INITIALIZE MAP
========================================================= */

function initializeBusMap() {

    if (
        typeof L === "undefined"
    ) {

        console.error(
            "Leaflet was not loaded."
        );

        return;
    }


    if (busMap) return;


    /*
       Default map location is India.

       It will automatically move to the
       bus location when a live bus appears.
    */

    busMap =
        L.map("busMap")
            .setView(
                [20.5937, 78.9629],
                5
            );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {

            maxZoom: 19,

            attribution:
                '&copy; OpenStreetMap contributors'

        }
    ).addTo(busMap);

}


/* =========================================================
   BUS CONTROLS
========================================================= */

function setupBusControls() {

    document
        .querySelectorAll(
            ".direction-btn"
        )
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    const direction =
                        button.dataset.direction;


                    currentDirection =
                        direction;


                    document
                        .querySelectorAll(
                            ".direction-btn"
                        )
                        .forEach(
                            (item) =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    button.classList.add(
                        "active"
                    );


                    selectedBusStop = "";

                    selectedBusNumber = null;


                    document
                        .getElementById(
                            "selectedBusInfo"
                        )
                        .classList.add(
                            "hidden"
                        );


                    populateBusStops();

                    renderAvailableBuses();

                    updateBusMarkers();

                }
            );

        });


    document
        .getElementById(
            "busStopSelect"
        )
        .addEventListener(
            "change",
            (event) => {

                selectedBusStop =
                    event.target.value;


                selectedBusNumber =
                    null;


                document
                    .getElementById(
                        "selectedBusInfo"
                    )
                    .classList.add(
                        "hidden"
                    );


                renderAvailableBuses();

                updateBusMarkers();

            }
        );

}


/* =========================================================
   LISTEN TO BUS ROUTES
========================================================= */

function listenForBusRoutes() {

    const routesRef =
        collection(
            db,
            "busRoutes"
        );


    if (routeUnsubscribe) {

        routeUnsubscribe();

    }


    routeUnsubscribe =
        onSnapshot(
            routesRef,
            (snapshot) => {

                busRoutes = [];


                snapshot.forEach(
                    (document) => {

                        busRoutes.push({

                            id:
                                document.id,

                            ...document.data()

                        });

                    }
                );


                populateBusStops();

                renderAvailableBuses();

                updateBusMarkers();

            },

            (error) => {

                console.error(
                    "Bus routes error:",
                    error
                );


                document.getElementById(
                    "busSelectionMessage"
                ).textContent =
                    "Unable to load bus routes.";

            }
        );

}


/* =========================================================
   LISTEN TO LIVE BUS LOCATIONS
========================================================= */

function listenForBusLocations() {

    const locationsRef =
        collection(
            db,
            "busLocations"
        );


    if (locationUnsubscribe) {

        locationUnsubscribe();

    }


    locationUnsubscribe =
        onSnapshot(
            locationsRef,
            (snapshot) => {

                busLocations = {};


                snapshot.forEach(
                    (document) => {

                        busLocations[
                            document.id
                        ] = {

                            id:
                                document.id,

                            ...document.data()

                        };

                    }
                );


                updateBusMarkers();

                renderAvailableBuses();

            },

            (error) => {

                console.error(
                    "Bus location error:",
                    error
                );


                document.getElementById(
                    "mapBusStatus"
                ).textContent =
                    "Location unavailable";

            }
        );

}


/* =========================================================
   POPULATE BUS STOPS
========================================================= */

function populateBusStops() {

    const select =
        document.getElementById(
            "busStopSelect"
        );


    const stops = new Set();


    busRoutes.forEach(
        (route) => {

            let routeStops = [];


            if (
                currentDirection ===
                "morning"
            ) {

                routeStops =
                    Array.isArray(
                        route.morningStops
                    )
                        ? route.morningStops
                        : [];

            }

            else {

                routeStops =
                    Array.isArray(
                        route.eveningStops
                    )
                        ? route.eveningStops
                        : [];

            }


            routeStops.forEach(
                (stop) => {

                    if (stop) {

                        stops.add(
                            String(stop)
                        );

                    }

                }
            );

        }
    );


    const sortedStops =
        [...stops].sort();


    select.innerHTML = `

        <option value="">
            Select your stopping
        </option>

    `;


    sortedStops.forEach(
        (stop) => {

            const option =
                document.createElement(
                    "option"
                );


            option.value = stop;

            option.textContent = stop;


            select.appendChild(
                option
            );

        }
    );


    if (
        selectedBusStop &&
        stops.has(selectedBusStop)
    ) {

        select.value =
            selectedBusStop;

    }

}


/* =========================================================
   FIND AVAILABLE BUSES
========================================================= */

function getAvailableBuses() {

    if (!selectedBusStop) {

        return [];

    }


    return busRoutes.filter(
        (route) => {

            if (
                route.active === false
            ) {

                return false;

            }


            let stops = [];


            if (
                currentDirection ===
                "morning"
            ) {

                stops =
                    Array.isArray(
                        route.morningStops
                    )
                        ? route.morningStops
                        : [];

            }

            else {

                stops =
                    Array.isArray(
                        route.eveningStops
                    )
                        ? route.eveningStops
                        : [];

            }


            return stops.some(
                (stop) =>
                    String(stop)
                        .toLowerCase() ===
                    selectedBusStop
                        .toLowerCase()
            );

        }
    );

}


/* =========================================================
   RENDER AVAILABLE BUSES
========================================================= */

function renderAvailableBuses() {

    const container =
        document.getElementById(
            "availableBusList"
        );


    const count =
        document.getElementById(
            "busCount"
        );


    const message =
        document.getElementById(
            "busSelectionMessage"
        );


    const buses =
        getAvailableBuses();


    count.textContent =
        `${buses.length} ${
            buses.length === 1
                ? "bus"
                : "buses"
        }`;


    if (!selectedBusStop) {

        container.innerHTML = `

            <div class="bus-empty-state">

                <div class="empty-bus-icon">
                    🚌
                </div>

                <h3>
                    Select your stop
                </h3>

                <p>
                    Available buses will appear here.
                </p>

            </div>

        `;


        message.textContent =
            "Select a stopping to find available buses.";

        return;

    }


    if (!buses.length) {

        container.innerHTML = `

            <div class="bus-empty-state">

                <div class="empty-bus-icon">
                    🔍
                </div>

                <h3>
                    No buses found
                </h3>

                <p>
                    No bus is currently configured
                    for this stopping.
                </p>

            </div>

        `;


        message.textContent =
            `No buses are configured for ${selectedBusStop}.`;

        return;

    }


    message.textContent =
        `${buses.length} bus${
            buses.length === 1
                ? ""
                : "es"
        } serve ${selectedBusStop}.`;


    container.innerHTML = "";


    buses.forEach(
        (route) => {

            const busNumber =
                route.busNumber ||
                route.id;


            const location =
                getBusLocation(
                    busNumber
                );


            const isLive =
                isBusLocationLive(
                    location
                );


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "bus-item";


            if (
                selectedBusNumber ===
                busNumber
            ) {

                card.classList.add(
                    "selected"
                );

            }


            let stops = [];


            if (
                currentDirection ===
                "morning"
            ) {

                stops =
                    route.morningStops || [];

            }

            else {

                stops =
                    route.eveningStops || [];

            }


            const routeText =
                stops.join(
                    " → "
                );


            card.innerHTML = `

                <div class="bus-item-top">

                    <div class="bus-number">

                        <div class="bus-number-icon">
                            🚌
                        </div>

                        <div>

                            <strong>
                                ${escapeHTML(
                                    busNumber
                                )}
                            </strong>

                            <span>
                                ${
                                    currentDirection ===
                                    "morning"
                                        ? "To College"
                                        : "From College"
                                }
                            </span>

                        </div>

                    </div>


                    <span
                        class="bus-live ${
                            isLive
                                ? "active"
                                : "offline"
                        }"
                    >
                        ${
                            isLive
                                ? "● LIVE"
                                : "OFFLINE"
                        }
                    </span>

                </div>


                <div class="bus-route-text">

                    <strong>Route:</strong>

                    ${escapeHTML(routeText)}

                </div>


                <button
                    class="view-map-btn"
                    data-bus-number="${escapeHTML(
                        busNumber
                    )}"
                >
                    View on Map
                </button>

            `;


            card.addEventListener(
                "click",
                () => {

                    selectBus(
                        busNumber,
                        route
                    );

                }
            );


            const mapButton =
                card.querySelector(
                    ".view-map-btn"
                );


            mapButton.addEventListener(
                "click",
                (event) => {

                    event.stopPropagation();


                    selectBus(
                        busNumber,
                        route
                    );

                }
            );


            container.appendChild(
                card
            );

        }
    );

}


/* =========================================================
   SELECT BUS
========================================================= */

function selectBus(
    busNumber,
    route
) {

    selectedBusNumber =
        busNumber;


    const info =
        document.getElementById(
            "selectedBusInfo"
        );


    info.classList.remove(
        "hidden"
    );


    document.getElementById(
        "selectedBusNumber"
    ).textContent =
        busNumber;


    const stops =
        currentDirection ===
        "morning"
            ? route.morningStops || []
            : route.eveningStops || [];


    document.getElementById(
        "selectedBusRoute"
    ).textContent =
        stops.join(
            " → "
        );


    renderAvailableBuses();


    const location =
        getBusLocation(
            busNumber
        );


    if (
        location &&
        isValidCoordinates(location)
    ) {

        focusMapOnBus(
            location
        );

    }

}


/* =========================================================
   GET BUS LOCATION
========================================================= */

function getBusLocation(
    busNumber
) {

    return (
        busLocations[busNumber] ||
        null
    );

}


/* =========================================================
   CHECK LOCATION IS LIVE
========================================================= */

function isBusLocationLive(
    location
) {

    if (!location) {

        return false;

    }


    if (
        location.isActive === false
    ) {

        return false;

    }


    const timestamp =
        getTimestampMillis(
            location.updatedAt
        );


    /*
       If Firebase server timestamp
       hasn't arrived yet.
    */

    if (!timestamp) {

        return true;

    }


    const age =
        Date.now() -
        timestamp;


    /*
       Consider bus live if updated
       within the last 2 minutes.
    */

    return age <=
        2 * 60 * 1000;

}


/* =========================================================
   VALIDATE GPS COORDINATES
========================================================= */

function isValidCoordinates(
    location
) {

    const latitude =
        Number(
            location.latitude
        );


    const longitude =
        Number(
            location.longitude
        );


    return (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
    );

}


/* =========================================================
   UPDATE MAP MARKERS
========================================================= */

function updateBusMarkers() {

    if (!busMap) return;


    const availableBuses =
        getAvailableBuses();


    const availableNumbers =
        new Set(
            availableBuses.map(
                (route) =>
                    route.busNumber ||
                    route.id
            )
        );


    /*
       Remove markers that no longer
       belong to the selected route.
    */

    Object.keys(busMarkers)
        .forEach((busNumber) => {

            if (
                !availableNumbers.has(
                    busNumber
                )
            ) {

                busMap.removeLayer(
                    busMarkers[busNumber]
                );


                delete busMarkers[
                    busNumber
                ];

            }

        });


    let liveCount = 0;

    const liveLocations = [];


    availableBuses.forEach(
        (route) => {

            const busNumber =
                route.busNumber ||
                route.id;


            const location =
                getBusLocation(
                    busNumber
                );


            if (
                !location ||
                !isValidCoordinates(
                    location
                )
            ) {

                return;

            }


            if (
                !isBusLocationLive(
                    location
                )
            ) {

                return;

            }


            liveCount++;


            const latitude =
                Number(
                    location.latitude
                );


            const longitude =
                Number(
                    location.longitude
                );


            liveLocations.push([
                latitude,
                longitude
            ]);


            const marker =
                createOrUpdateBusMarker(
                    busNumber,
                    location
                );


            if (
                selectedBusNumber ===
                busNumber
            ) {

                marker.setZIndexOffset(
                    1000
                );

            }

        }
    );


    document.getElementById(
        "busCount"
    ).textContent =
        `${availableBuses.length} ${
            availableBuses.length === 1
                ? "bus"
                : "buses"
        }`;


    document.getElementById(
        "mapBusStatus"
    ).textContent =
        liveCount > 0
            ? `${liveCount} live`
            : "No live buses";


    if (liveCount > 0) {

        document.getElementById(
            "lastMapUpdate"
        ).textContent =
            `Updated ${new Date()
                .toLocaleTimeString()}`;

    }

    else {

        document.getElementById(
            "lastMapUpdate"
        ).textContent =
            "No live updates yet";

    }


    /*
       If we have live buses and
       no bus was manually selected,
       fit the map to all live buses.
    */

    if (
        liveLocations.length > 0 &&
        !selectedBusNumber
    ) {

        const bounds =
            L.latLngBounds(
                liveLocations
            );


        busMap.fitBounds(
            bounds,
            {
                padding: [40, 40],

                maxZoom: 15
            }
        );

    }


    /*
       If a selected bus has a location,
       keep focus on it.
    */

    if (selectedBusNumber) {

        const selectedLocation =
            getBusLocation(
                selectedBusNumber
            );


        if (
            selectedLocation &&
            isValidCoordinates(
                selectedLocation
            )
        ) {

            focusMapOnBus(
                selectedLocation
            );

        }

    }

}


/* =========================================================
   CREATE / UPDATE BUS MARKER
========================================================= */

function createOrUpdateBusMarker(
    busNumber,
    location
) {

    const latitude =
        Number(
            location.latitude
        );


    const longitude =
        Number(
            location.longitude
        );


    const markerHTML = `

        <div class="bus-map-marker">

            <div class="bus-marker-icon">
                🚌
            </div>

            <div class="bus-marker-label">
                ${escapeHTML(
                    busNumber
                )}
            </div>

        </div>

    `;


    const icon =
        L.divIcon({

            html: markerHTML,

            className: "",

            iconSize: [
                70,
                65
            ],

            iconAnchor: [
                35,
                25
            ]

        });


    if (
        busMarkers[busNumber]
    ) {

        busMarkers[
            busNumber
        ].setLatLng([
            latitude,
            longitude
        ]);


        busMarkers[
            busNumber
        ].setIcon(icon);


        return busMarkers[
            busNumber
        ];

    }


    const marker =
        L.marker(
            [
                latitude,
                longitude
            ],
            {
                icon
            }
        ).addTo(busMap);


    marker.bindPopup(`

        <div style="
            min-width: 130px;
            font-family: Inter, sans-serif;
        ">

            <strong>
                🚌 ${escapeHTML(
                    busNumber
                )}
            </strong>

            <br>

            <span style="
                color: #16a34a;
                font-size: 12px;
            ">
                ● Live location
            </span>

            <br><br>

            <span style="
                font-size: 11px;
                color: #6b7280;
            ">
                ${latitude.toFixed(5)},
                ${longitude.toFixed(5)}
            </span>

        </div>

    `);


    busMarkers[
        busNumber
    ] = marker;


    return marker;

}


/* =========================================================
   FOCUS MAP ON BUS
========================================================= */

function focusMapOnBus(
    location
) {

    if (
        !busMap ||
        !isValidCoordinates(
            location
        )
    ) {

        return;

    }


    const latitude =
        Number(
            location.latitude
        );


    const longitude =
        Number(
            location.longitude
        );


    busMap.flyTo(
        [
            latitude,
            longitude
        ],
        16,
        {
            duration: 0.8
        }
    );


    /*
       Open selected bus popup.
    */

    if (
        selectedBusNumber &&
        busMarkers[
            selectedBusNumber
        ]
    ) {

        setTimeout(() => {

            busMarkers[
                selectedBusNumber
            ].openPopup();

        }, 500);

    }

}


/* =========================================================
   LOGOUT
========================================================= */

document.getElementById(
    "logoutBtn"
).addEventListener(
    "click",
    async () => {

        try {

            await signOut(auth);

            window.location.href =
                "login.html";

        }

        catch (error) {

            console.error(
                "Logout error:",
                error
            );

            alert(
                "Unable to logout. Please try again."
            );

        }

    }
);
