// 요일별 기본 시간표 입력과 저장을 담당한다.

let selectedDay = 5;

const DAY_CONFIG = {
  1: { name: "월요일", key: "smon", fields: ["mc1", "mc2", "mc3", "mc4", "mc5", "mc6", "mc7"] },
  2: { name: "화요일", key: "stues", fields: ["tuc1", "tuc2", "tuc3", "tuc4", "tuc5", "tuc6", "tuc7"] },
  3: { name: "수요일", key: "swed", fields: ["wc1", "wc2", "wc3", "wc4", "wc5", "wc6", "wc7"] },
  4: { name: "목요일", key: "sthurs", fields: ["thc1", "thc2", "thc3", "thc4", "thc5", "thc6", "thc7"] },
  5: { name: "금요일", key: "sfri", fields: ["fc1", "fc2", "fc3", "fc4", "fc5", "fc6", "fc7"] },
};

function readSavedDay(dayNumber) {
  const config = DAY_CONFIG[dayNumber];
  if (!config) return ["", "", "", "", "", "", ""];

  const raw = localStorage.getItem(config.key);
  if (!raw) return ["", "", "", "", "", "", ""];

  try {
    const saved = JSON.parse(raw);
    return config.fields.map(function (field) {
      return saved[field] || "";
    });
  } catch (error) {
    return ["", "", "", "", "", "", ""];
  }
}

function makeScheduleEditor(dayNumber) {
  const scheduleArea = document.querySelector("#scheduleArea");
  if (!scheduleArea) return;

  const config = DAY_CONFIG[dayNumber];
  const savedValues = readSavedDay(dayNumber);

  scheduleArea.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = config.name + " 기본 시간표";

  const description = document.createElement("p");
  description.className = "form-description";
  description.textContent = "과목명만 먼저 입력합니다. 수업 장소는 다음 단계에서 별도 설정 기능으로 연결합니다.";

  const list = document.createElement("div");
  list.className = "schedule-input-list";

  for (let i = 0; i < 7; i++) {
    const row = document.createElement("div");
    row.className = "schedule-input-row";

    const label = document.createElement("label");
    label.setAttribute("for", "c" + (i + 1));
    label.textContent = i + 1 + "교시";

    const input = document.createElement("input");
    input.type = "text";
    input.id = "c" + (i + 1);
    input.placeholder = "과목명 입력";
    input.value = savedValues[i];
    input.autocomplete = "off";

    row.appendChild(label);
    row.appendChild(input);
    list.appendChild(row);
  }

  const actions = document.createElement("div");
  actions.className = "button-row";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "store_slt";
  saveButton.textContent = "시간표 저장";
  actions.appendChild(saveButton);

  scheduleArea.appendChild(title);
  scheduleArea.appendChild(description);
  scheduleArea.appendChild(list);
  scheduleArea.appendChild(actions);
}

function saveSelectedDay() {
  const config = DAY_CONFIG[selectedDay];
  const saved = {};

  config.fields.forEach(function (field, index) {
    const input = document.querySelector("#c" + (index + 1));
    saved[field] = input ? input.value.trim() : "";
  });

  localStorage.setItem(config.key, JSON.stringify(saved));
  alert(config.name + " 시간표를 저장했습니다.");
}

function selectDay(dayNumber, clickedButton) {
  selectedDay = dayNumber;

  document.querySelectorAll(".day-btn").forEach(function (button) {
    button.classList.remove("active");
  });

  if (clickedButton) clickedButton.classList.add("active");
  makeScheduleEditor(dayNumber);
}

const dayButtons = [
  [".mon", 1],
  [".tues", 2],
  [".wednes", 3],
  [".thurs", 4],
  [".fri", 5],
];

dayButtons.forEach(function (item) {
  const button = document.querySelector(item[0]);
  if (!button) return;

  button.addEventListener("click", function () {
    selectDay(item[1], button);
  });
});

const scheduleArea = document.querySelector("#scheduleArea");
if (scheduleArea) {
  scheduleArea.addEventListener("click", function (event) {
    if (event.target.classList.contains("store_slt")) {
      saveSelectedDay();
    }
  });

  const fridayButton = document.querySelector(".fri");
  selectDay(5, fridayButton);
}
