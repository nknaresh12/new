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
    getDocs,
    query,
    where
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
   AUTHENTICATION
========================================================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "login.html";

        return;
    }


    currentUser = user;


    try {

        await loadStudentData();

        await loadMarks();

        setupEventListeners();

        renderOverview();

        renderMarks();

        runPerformanceAnalysis();

    } catch (error) {

        console.error(
            "Error loading student dashboard:",
            error
        );

    }

});



/* =========================================================
   LOAD STUDENT PROFILE
========================================================= */

async function loadStudentData() {

    const studentRef = doc(
        db,
        "students",
        currentUser.uid
    );


    const studentSnap = await getDoc(studentRef);


    if (!studentSnap.exists()) {

        alert(
            "Student profile not found."
        );

        await signOut(auth);

        window.location.href =
            "login.html";

        return;
    }


    studentData = {

        id: studentSnap.id,

        ...studentSnap.data()

    };


    updateStudentProfile();

}



/* =========================================================
   UPDATE PROFILE UI
========================================================= */

function updateStudentProfile() {

    const name =
        studentData.studentName || "Student";


    const studentId =
        studentData.studentId || "-";


    const email =
        studentData.email ||
        currentUser.email ||
        "-";


    const firstLetter =
        name.charAt(0).toUpperCase();


    document.getElementById(
        "studentNameTop"
    ).textContent = name;


    document.getElementById(
        "studentIdTop"
    ).textContent = studentId;


    document.getElementById(
        "profileAvatar"
    ).textContent = firstLetter;


    document.getElementById(
        "welcomeName"
    ).textContent = name;


    document.getElementById(
        "studentIdInfo"
    ).textContent = studentId;


    document.getElementById(
        "studentNameInfo"
    ).textContent = name;


    document.getElementById(
        "studentEmailInfo"
    ).textContent = email;

}



/* =========================================================
   LOAD MARKS
========================================================= */

async function loadMarks() {

    allMarks = [];


    const marksRef =
        collection(db, "marks");


    const q = query(
        marksRef,
        where(
            "studentId",
            "==",
            studentData.studentId
        )
    );


    const snapshot =
        await getDocs(q);


    snapshot.forEach((markDoc) => {

        allMarks.push({

            id: markDoc.id,

            ...markDoc.data()

        });

    });


    console.log(
        "Marks loaded:",
        allMarks
    );

}



/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEventListeners() {


    /* -------------------------------
       TAB BUTTONS
    -------------------------------- */

    document
        .querySelectorAll(".nav-item")
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    const tab =
                        button.dataset.tab;


                    if (!tab) return;


                    switchTab(tab);

                }
            );

        });



    /* -------------------------------
       MARK FILTERS
    -------------------------------- */

    const semesterFilter =
        document.getElementById(
            "marksSemesterFilter"
        );


    const examFilter =
        document.getElementById(
            "marksExamFilter"
        );


    if (semesterFilter) {

        semesterFilter.addEventListener(
            "change",
            renderMarks
        );

    }


    if (examFilter) {

        examFilter.addEventListener(
            "change",
            renderMarks
        );

    }



    /* -------------------------------
       ANALYSIS SEMESTER
    -------------------------------- */

    const analysisSemester =
        document.getElementById(
            "analysisSemester"
        );


    if (analysisSemester) {

        analysisSemester.addEventListener(
            "change",
            runPerformanceAnalysis
        );

    }



    /* -------------------------------
       MAX MARKS
    -------------------------------- */

    const maxMarksInput =
        document.getElementById(
            "semesterMaxMarks"
        );


    if (maxMarksInput) {

        maxMarksInput.addEventListener(
            "input",
            runPerformanceAnalysis
        );

    }



    /* -------------------------------
       LOGOUT
    -------------------------------- */

    const logoutBtn =
        document.getElementById(
            "logoutBtn"
        );


    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            logoutStudent
        );

    }

}



/* =========================================================
   SWITCH TABS
========================================================= */

function switchTab(tabName) {

    document
        .querySelectorAll(".tab-content")
        .forEach((tab) => {

            tab.classList.remove(
                "active"
            );

        });


    document
        .querySelectorAll(".nav-item")
        .forEach((button) => {

            button.classList.remove(
                "active"
            );

        });



    const selectedTab =
        document.getElementById(
            `${tabName}Tab`
        );


    if (selectedTab) {

        selectedTab.classList.add(
            "active"
        );

    }


    const selectedButton =
        document.querySelector(
            `[data-tab="${tabName}"]`
        );


    if (selectedButton) {

        selectedButton.classList.add(
            "active"
        );

    }

}



/* =========================================================
   RENDER OVERVIEW
========================================================= */

function renderOverview() {

    const subjects = new Set();

    let totalPercentage = 0;

    let percentageCount = 0;

    const exams = new Set();

    const semesters = new Set();


    allMarks.forEach((mark) => {

        if (mark.subject) {

            subjects.add(
                mark.subject
            );

        }


        const percentage =
            calculatePercentage(mark);


        if (!isNaN(percentage)) {

            totalPercentage +=
                percentage;

            percentageCount++;

        }


        const examId =
            getModelExamId(mark);


        if (examId) {

            exams.add(examId);

        }


        if (mark.semester) {

            semesters.add(
                String(mark.semester)
            );

        }

    });


    const average =
        percentageCount > 0
            ? totalPercentage / percentageCount
            : 0;


    document.getElementById(
        "totalSubjects"
    ).textContent =
        subjects.size;


    document.getElementById(
        "averageMarks"
    ).textContent =
        `${average.toFixed(1)}%`;


    document.getElementById(
        "totalExams"
    ).textContent =
        exams.size;


    const currentSemester =
        semesters.size > 0
            ? Math.max(
                ...Array.from(
                    semesters
                ).map(Number)
            )
            : 1;


    document.getElementById(
        "currentSemester"
    ).textContent =
        currentSemester;


    renderOverviewSubjects();

}



/* =========================================================
   RENDER OVERVIEW SUBJECTS
========================================================= */

function renderOverviewSubjects() {

    const tbody =
        document.getElementById(
            "overviewSubjectsTable"
        );


    tbody.innerHTML = "";


    const subjectData = {};


    allMarks.forEach((mark) => {

        const subject =
            mark.subject;


        if (!subject) return;


        const percentage =
            calculatePercentage(mark);


        if (!subjectData[subject]) {

            subjectData[subject] = [];

        }


        subjectData[subject].push(
            percentage
        );

    });


    Object.keys(subjectData)
        .sort()
        .forEach((subject) => {

            const average =
                averageArray(
                    subjectData[subject]
                );


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${escapeHTML(subject)}
                </td>

                <td>
                    ${average.toFixed(1)}%
                </td>

                <td>
                    <span class="status-badge">
                        ${getStatus(average)}
                    </span>
                </td>

            `;


            tbody.appendChild(row);

        });

}



/* =========================================================
   RENDER MARKS
========================================================= */

function renderMarks() {

    const tbody =
        document.getElementById(
            "marksTableBody"
        );


    if (!tbody) return;


    tbody.innerHTML = "";


    const semesterFilter =
        document.getElementById(
            "marksSemesterFilter"
        ).value;


    const examFilter =
        document.getElementById(
            "marksExamFilter"
        ).value;


    const filtered =
        allMarks.filter((mark) => {

            const semesterMatch =
                semesterFilter === "all" ||
                String(mark.semester) ===
                String(semesterFilter);


            const examId =
                getModelExamId(mark);


            const examMatch =
                examFilter === "all" ||
                String(examId) ===
                String(examFilter);


            return (
                semesterMatch &&
                examMatch
            );

        });


    filtered
        .sort((a, b) => {

            return (
                Number(a.semester || 0) -
                Number(b.semester || 0)
            );

        })
        .forEach((mark) => {

            const row =
                document.createElement(
                    "tr"
                );


            const percentage =
                calculatePercentage(mark);


            row.innerHTML = `

                <td>
                    Semester ${escapeHTML(
                        String(mark.semester || "-")
                    )}
                </td>

                <td>
                    Model Exam ${getModelExamId(mark)}
                </td>

                <td>
                    ${escapeHTML(
                        mark.subject || "-"
                    )}
                </td>

                <td>
                    ${mark.marks ?? 0}
                    /
                    ${mark.maxMarks ?? 100}
                </td>

                <td>
                    ${percentage.toFixed(1)}%
                </td>

            `;


            tbody.appendChild(row);

        });


    if (filtered.length === 0) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    style="text-align:center;"
                >
                    No marks available.
                </td>

            </tr>

        `;

    }

}



/* =========================================================
   PERFORMANCE ANALYSIS
========================================================= */

function runPerformanceAnalysis() {

    const semester =
        document.getElementById(
            "analysisSemester"
        ).value;


    const maxMarks =
        Number(
            document.getElementById(
                "semesterMaxMarks"
            ).value
        ) || 100;


    const prediction =
        calculateWeightedPrediction(
            semester
        );


    renderPredictionSummary(
        prediction,
        maxMarks
    );


    renderPredictionTable(
        prediction
    );


    renderPriorityAreas(
        prediction
    );


    renderRecommendations(
        prediction
    );


    renderOverallInsight(
        prediction
    );

}



/* =========================================================
   GET MODEL EXAM ID
========================================================= */

function getModelExamId(mark) {

    if (
        mark.examId !== undefined &&
        mark.examId !== null &&
        mark.examId !== ""
    ) {

        const numeric =
            Number(mark.examId);


        if (
            numeric === 1 ||
            numeric === 2 ||
            numeric === 3
        ) {

            return numeric;

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



/* =========================================================
   GET LATEST MARKS FOR EACH MODEL
========================================================= */

function getLatestModelMarks(
    semester
) {

    const result = {};


    const semesterMarks =
        allMarks.filter(
            (mark) =>
                String(mark.semester) ===
                String(semester)
        );


    semesterMarks.forEach((mark) => {

        const examId =
            getModelExamId(mark);


        if (!examId) return;


        const subject =
            mark.subject;


        if (!subject) return;


        if (!result[subject]) {

            result[subject] = {};

        }


        const existing =
            result[subject][examId];


        if (
            !existing ||
            getTimestampMillis(
                mark.uploadedAt
            ) >=
            getTimestampMillis(
                existing.uploadedAt
            )
        ) {

            result[subject][examId] =
                mark;

        }

    });


    return result;

}



/* =========================================================
   WEIGHTED PREDICTION
========================================================= */

function calculateWeightedPrediction(
    semester
) {

    const subjectModels =
        getLatestModelMarks(
            semester
        );


    const weights = {

        1: 0.20,

        2: 0.30,

        3: 0.50

    };


    const subjects = {};


    let modelsUsed = new Set();


    Object.keys(subjectModels)
        .forEach((subject) => {

            const modelData =
                subjectModels[subject];


            const available =
                Object.keys(modelData)
                    .map(Number)
                    .filter(
                        (id) =>
                            id >= 1 &&
                            id <= 3
                    );


            available.forEach(
                (id) =>
                    modelsUsed.add(id)
            );


            if (
                available.length === 0
            ) {

                return;

            }


            let weightTotal = 0;

            let weightedValue = 0;


            available.forEach(
                (modelId) => {

                    const mark =
                        modelData[
                            modelId
                        ];


                    const percentage =
                        calculatePercentage(
                            mark
                        );


                    weightedValue +=
                        percentage *
                        weights[modelId];


                    weightTotal +=
                        weights[modelId];

                }
            );


            const predictedPercentage =
                weightTotal > 0
                    ? weightedValue /
                      weightTotal
                    : 0;


            subjects[subject] = {

                predictedPercentage,

                models: available

            };

        });


    const subjectPercentages =
        Object.values(subjects)
            .map(
                (item) =>
                    item.predictedPercentage
            );


    const predictedPercentage =
        subjectPercentages.length > 0
            ? averageArray(
                subjectPercentages
            )
            : 0;


    return {

        semester,

        subjects,

        predictedPercentage,

        modelsUsed:
            modelsUsed.size

    };

}



/* =========================================================
   RENDER PREDICTION SUMMARY
========================================================= */

function renderPredictionSummary(
    prediction,
    maxMarks
) {

    /*
        predictedPercentage is always a percentage
        between 0 and 100.

        Example:
        predictedPercentage = 64.25

        Semester maximum marks = 100

        Predicted semester score = 64.25

        GPA:
        64.25 / 100 * 10
        = 6.425
        = 6.43
    */


    const predictedScore =
        (
            prediction.predictedPercentage *
            maxMarks
        ) / 100;


    /*
        Convert the predicted semester score
        into GPA out of 10.
    */

    const predictedGPA =
        maxMarks > 0
            ? (
                predictedScore /
                maxMarks
            ) * 10
            : 0;


    /*
        Display GPA
    */

    document.getElementById(
        "predictedScore"
    ).textContent =
        predictedGPA.toFixed(2);


    /*
        Progress bar should still represent
        the predicted percentage.
    */

    const progress =
        document.getElementById(
            "predictionProgress"
        );


    if (progress) {

        progress.style.width =
            `${Math.max(
                0,
                Math.min(
                    100,
                    prediction.predictedPercentage
                )
            )}%`;

    }


    /*
        Models used
    */

    document.getElementById(
        "modelsUsed"
    ).textContent =
        `${prediction.modelsUsed} / 3`;


    /*
        Find strongest and weakest subjects
    */

    const subjectEntries =
        Object.entries(
            prediction.subjects
        );


    if (
        subjectEntries.length === 0
    ) {

        document.getElementById(
            "strongestSubject"
        ).textContent = "-";


        document.getElementById(
            "weakestSubject"
        ).textContent = "-";


        document.getElementById(
            "strongestPercentage"
        ).textContent =
            "No data available";


        document.getElementById(
            "weakestPercentage"
        ).textContent =
            "No data available";


        return;

    }


    subjectEntries.sort(
        (a, b) =>
            b[1].predictedPercentage -
            a[1].predictedPercentage
    );


    const strongest =
        subjectEntries[0];


    const weakest =
        subjectEntries[
            subjectEntries.length - 1
        ];


    document.getElementById(
        "strongestSubject"
    ).textContent =
        strongest[0];


    document.getElementById(
        "strongestPercentage"
    ).textContent =
        `${strongest[1].predictedPercentage.toFixed(
            1
        )}% predicted`;


    document.getElementById(
        "weakestSubject"
    ).textContent =
        weakest[0];


    document.getElementById(
        "weakestPercentage"
    ).textContent =
        `${weakest[1].predictedPercentage.toFixed(
            1
        )}% predicted`;

}



/* =========================================================
   RENDER PREDICTION TABLE
========================================================= */

function renderPredictionTable(
    prediction
) {

    const tbody =
        document.getElementById(
            "predictionTableBody"
        );


    tbody.innerHTML = "";


    const entries =
        Object.entries(
            prediction.subjects
        );


    entries
        .sort(
            (a, b) =>
                b[1].predictedPercentage -
                a[1].predictedPercentage
        )
        .forEach(
            ([subject, data]) => {

                const row =
                    document.createElement(
                        "tr"
                    );


                row.innerHTML = `

                    <td>
                        ${escapeHTML(subject)}
                    </td>

                    <td>
                        ${data.predictedPercentage.toFixed(1)}%
                    </td>

                    <td>
                        <span class="status-badge">
                            ${getStatus(
                                data.predictedPercentage
                            )}
                        </span>
                    </td>

                `;


                tbody.appendChild(row);

            }
        );


    if (entries.length === 0) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="3"
                    style="text-align:center;"
                >
                    No model exam marks available
                    for this semester.
                </td>

            </tr>

        `;

    }

}



/* =========================================================
   TREND
========================================================= */

function calculateTrend(
    semester
) {

    const model1 = [];
    const model3 = [];


    const subjectModels =
        getLatestModelMarks(
            semester
        );


    Object.values(subjectModels)
        .forEach((models) => {

            if (models[1]) {

                model1.push(
                    calculatePercentage(
                        models[1]
                    )
                );

            }


            if (models[3]) {

                model3.push(
                    calculatePercentage(
                        models[3]
                    )
                );

            }

        });


    if (
        model1.length === 0 ||
        model3.length === 0
    ) {

        return "Not enough data to determine trend.";

    }


    const first =
        averageArray(model1);


    const last =
        averageArray(model3);


    const difference =
        last - first;


    if (difference >= 5) {

        return "Your performance is improving.";

    }


    if (difference <= -5) {

        return "Your performance is falling. Focus on the priority subjects.";

    }


    return "Your performance is relatively stable.";

}



/* =========================================================
   RENDER TREND
========================================================= */

function renderTrend(
    prediction
) {

    const trend =
        calculateTrend(
            prediction.semester
        );


    const trendText =
        document.getElementById(
            "trendText"
        );


    if (trendText) {

        trendText.textContent =
            trend;

    }

}



/* =========================================================
   RENDER PRIORITY AREAS
========================================================= */

function renderPriorityAreas(
    prediction
) {

    const container =
        document.getElementById(
            "priorityAreas"
        );


    container.innerHTML = "";


    const prioritySubjects =
        Object.entries(
            prediction.subjects
        )
        .filter(
            ([, data]) =>
                data.predictedPercentage < 70
        )
        .sort(
            (a, b) =>
                a[1].predictedPercentage -
                b[1].predictedPercentage
        );


    if (
        prioritySubjects.length === 0
    ) {

        container.innerHTML = `

            <p>
                No high-priority subjects at the moment.
                Keep maintaining your performance.
            </p>

        `;

        return;

    }


    prioritySubjects.forEach(
        ([subject, data]) => {

            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "priority-item";


            div.innerHTML = `

                <strong>
                    ${escapeHTML(subject)}
                </strong>

                <span>
                    ${data.predictedPercentage.toFixed(1)}%
                </span>

            `;


            container.appendChild(div);

        }
    );

}



/* =========================================================
   RENDER RECOMMENDATIONS
========================================================= */

function renderRecommendations(
    prediction
) {

    const container =
        document.getElementById(
            "recommendations"
        );


    container.innerHTML = "";


    const subjects =
        Object.entries(
            prediction.subjects
        )
        .sort(
            (a, b) =>
                a[1].predictedPercentage -
                b[1].predictedPercentage
        );


    if (subjects.length === 0) {

        container.innerHTML = `

            <p>
                Upload model examination marks
                to receive recommendations.
            </p>

        `;

        return;

    }


    subjects
        .slice(0, 3)
        .forEach(
            ([subject, data]) => {

                const div =
                    document.createElement(
                        "div"
                    );


                div.className =
                    "recommendation-item";


                div.innerHTML = `

                    <strong>
                        Focus on ${escapeHTML(subject)}
                    </strong>

                    <p>
                        Your predicted performance
                        is ${data.predictedPercentage.toFixed(1)}%.
                        Give this subject additional
                        revision time.
                    </p>

                `;


                container.appendChild(div);

            }
        );

}



/* =========================================================
   OVERALL INSIGHT
========================================================= */

function renderOverallInsight(
    prediction
) {

    const container =
        document.getElementById(
            "overallInsight"
        );


    const percentage =
        prediction.predictedPercentage;


    if (
        Object.keys(
            prediction.subjects
        ).length === 0
    ) {

        container.innerHTML = `

            <p>
                No model examination marks are
                available for this semester yet.
            </p>

        `;

        renderTrend(prediction);

        return;

    }


    let message = "";


    if (percentage >= 80) {

        message =
            `Your predicted performance is ${percentage.toFixed(
                1
            )}%. You are maintaining a strong academic performance.`;

    } else if (percentage >= 70) {

        message =
            `Your predicted performance is ${percentage.toFixed(
                1
            )}%. Your overall performance is good, with some room for improvement.`;

    } else if (percentage >= 50) {

        message =
            `Your predicted performance is ${percentage.toFixed(
                1
            )}%. Focus on your lower-performing subjects to improve your semester result.`;

    } else {

        message =
            `Your predicted performance is ${percentage.toFixed(
                1
            )}%. Several subjects need immediate attention and additional preparation.`;

    }


    container.innerHTML = `

        <p>
            ${message}
        </p>

    `;


    renderTrend(prediction);

}



/* =========================================================
   STATUS
========================================================= */

function getStatus(
    percentage
) {

    if (percentage < 50) {

        return "High Priority";

    }


    if (percentage < 70) {

        return "Needs Attention";

    }


    if (percentage < 80) {

        return "Moderate";

    }


    return "Good";

}



/* =========================================================
   CALCULATE PERCENTAGE
========================================================= */

function calculatePercentage(
    mark
) {

    const marks =
        Number(mark.marks);


    const maxMarks =
        Number(mark.maxMarks) || 100;


    if (
        isNaN(marks) ||
        maxMarks <= 0
    ) {

        return 0;

    }


    return (
        marks / maxMarks
    ) * 100;

}



/* =========================================================
   AVERAGE ARRAY
========================================================= */

function averageArray(
    values
) {

    if (
        !values ||
        values.length === 0
    ) {

        return 0;

    }


    return (
        values.reduce(
            (sum, value) =>
                sum + Number(value),
            0
        ) / values.length
    );

}



/* =========================================================
   TIMESTAMP
========================================================= */

function getTimestampMillis(
    timestamp
) {

    if (!timestamp) {

        return 0;

    }


    if (
        typeof timestamp.toMillis ===
        "function"
    ) {

        return timestamp.toMillis();

    }


    if (
        timestamp.seconds !== undefined
    ) {

        return (
            Number(timestamp.seconds) *
            1000
        );

    }


    if (
        timestamp instanceof Date
    ) {

        return timestamp.getTime();

    }


    return 0;

}



/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(
    timestamp
) {

    const millis =
        getTimestampMillis(
            timestamp
        );


    if (!millis) {

        return "-";

    }


    return new Date(
        millis
    ).toLocaleDateString();

}



/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(
    value
) {

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
   LOGOUT
========================================================= */

async function logoutStudent() {

    try {

        await signOut(auth);

        window.location.href =
            "login.html";

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
