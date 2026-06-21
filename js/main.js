//학교 설정이랑 홈 화면을 관리하는 파일
//컴시간 자동 조회는 브라우저에서 막혀서 이 파일에서는 직접 저장한 정보만 사용한다


//localStorage에 저장할 때 사용할 이름들
let saveSchoolName = "schoolName";
let saveSchoolGrade = "schoolGrade";
let saveSchoolClass = "schoolClass";


//오늘 요일을 숫자로 알아내는 함수
//일요일은 0, 토요일은 6이라서 주말에는 월요일 시간표를 보여주도록 함
function getTodayNumber() {
  //getDay는 월요일부터가 아니라 일요일부터 시작하는 점 주의
  let today = new Date();
  let todayNumber = today.getDay();

  if (todayNumber == 0) {
    //주말에는 수업이 없으니 다음에 볼 월요일 기준으로 보여준다
    todayNumber = 1;
  }

  if (todayNumber == 6) {
    todayNumber = 1;
  }

  return todayNumber;
}


//요일 숫자를 한글 이름으로 바꾸기
function getTodayName(todayNumber) {
  //배열도 가능하지만 숫자랑 이름을 눈으로 바로 확인하려고 if문으로 작성함
  let todayName = "월요일";

  if (todayNumber == 1) {
    todayName = "월요일";
  } else if (todayNumber == 2) {
    todayName = "화요일";
  } else if (todayNumber == 3) {
    todayName = "수요일";
  } else if (todayNumber == 4) {
    todayName = "목요일";
  } else if (todayNumber == 5) {
    todayName = "금요일";
  }

  return todayName;
}


//data.js에서 저장한 기본 시간표를 오늘 요일에 맞게 꺼내온다
function getBasicSchedule(todayNumber) {
  //저장된 값이 하나도 없을 때를 생각해서 빈 7칸으로 시작
  let basicSchedule = ["", "", "", "", "", "", ""];

  if (todayNumber == 1) {
    let mondayString = localStorage.getItem("smon");

    if (mondayString !== null) {
      //저장할 때 JSON 문자열로 바꿨으므로 여기서는 다시 객체로 되돌림
      let mondayObject = JSON.parse(mondayString);
      basicSchedule[0] = mondayObject.mc1;
      basicSchedule[1] = mondayObject.mc2;
      basicSchedule[2] = mondayObject.mc3;
      basicSchedule[3] = mondayObject.mc4;
      basicSchedule[4] = mondayObject.mc5;
      basicSchedule[5] = mondayObject.mc6;
      basicSchedule[6] = mondayObject.mc7;
    }
  } else if (todayNumber == 2) {
    let tuesdayString = localStorage.getItem("stues");

    if (tuesdayString !== null) {
      let tuesdayObject = JSON.parse(tuesdayString);
      basicSchedule[0] = tuesdayObject.tuc1;
      basicSchedule[1] = tuesdayObject.tuc2;
      basicSchedule[2] = tuesdayObject.tuc3;
      basicSchedule[3] = tuesdayObject.tuc4;
      basicSchedule[4] = tuesdayObject.tuc5;
      basicSchedule[5] = tuesdayObject.tuc6;
      basicSchedule[6] = tuesdayObject.tuc7;
    }
  } else if (todayNumber == 3) {
    let wednesdayString = localStorage.getItem("swed");

    if (wednesdayString !== null) {
      let wednesdayObject = JSON.parse(wednesdayString);
      basicSchedule[0] = wednesdayObject.wc1;
      basicSchedule[1] = wednesdayObject.wc2;
      basicSchedule[2] = wednesdayObject.wc3;
      basicSchedule[3] = wednesdayObject.wc4;
      basicSchedule[4] = wednesdayObject.wc5;
      basicSchedule[5] = wednesdayObject.wc6;
      basicSchedule[6] = wednesdayObject.wc7;
    }
  } else if (todayNumber == 4) {
    let thursdayString = localStorage.getItem("sthurs");

    if (thursdayString !== null) {
      let thursdayObject = JSON.parse(thursdayString);
      basicSchedule[0] = thursdayObject.thc1;
      basicSchedule[1] = thursdayObject.thc2;
      basicSchedule[2] = thursdayObject.thc3;
      basicSchedule[3] = thursdayObject.thc4;
      basicSchedule[4] = thursdayObject.thc5;
      basicSchedule[5] = thursdayObject.thc6;
      basicSchedule[6] = thursdayObject.thc7;
    }
  } else if (todayNumber == 5) {
    let fridayString = localStorage.getItem("sfri");

    if (fridayString !== null) {
      let fridayObject = JSON.parse(fridayString);
      basicSchedule[0] = fridayObject.fc1;
      basicSchedule[1] = fridayObject.fc2;
      basicSchedule[2] = fridayObject.fc3;
      basicSchedule[3] = fridayObject.fc4;
      basicSchedule[4] = fridayObject.fc5;
      basicSchedule[5] = fridayObject.fc6;
      basicSchedule[6] = fridayObject.fc7;
    }
  }

  return basicSchedule;
}


//설정 페이지에서 학교, 학년, 반을 직접 저장하는 함수
function storeSchoolSetting() {
  //버튼을 누르는 시점의 입력값을 가져와야 해서 함수 안에서 요소를 찾는다
  let schoolNameInput = document.querySelector("#school_name_input");
  let gradeSelect = document.querySelector("#grade_select");
  let classSelect = document.querySelector("#class_select");

  if (schoolNameInput.value == "") {
    //학교 이름도 없이 저장되는 건 막아둠
    alert("학교 이름을 입력해 주세요.");
    return;
  }

  //세 값은 나중에 따로 쓰기 편하게 각각 저장했다
  localStorage.setItem(saveSchoolName, schoolNameInput.value);
  localStorage.setItem(saveSchoolGrade, gradeSelect.value);
  localStorage.setItem(saveSchoolClass, classSelect.value);

  showSchoolSetting();
  alert("학교와 반을 저장했습니다.");
}


//설정 페이지 아래쪽에 현재 저장된 값을 보여준다
function showSchoolSetting() {
  //아래 세 문단에 localStorage 값을 하나씩 넣어줄 예정
  let schoolText = document.querySelector("#now_school_text");
  let gradeText = document.querySelector("#now_grade_text");
  let classText = document.querySelector("#now_class_text");

  let schoolName = localStorage.getItem(saveSchoolName);
  let schoolGrade = localStorage.getItem(saveSchoolGrade);
  let schoolClass = localStorage.getItem(saveSchoolClass);

  if (schoolName === null) {
    //전에 저장한 게 없으면 html에 있던 것과 같은 안내를 넣는다
    schoolText.textContent = "학교: 아직 저장하지 않음";
  } else {
    schoolText.textContent = "학교: " + schoolName;
  }

  if (schoolGrade === null) {
    gradeText.textContent = "학년: 아직 저장하지 않음";
  } else {
    gradeText.textContent = "학년: " + schoolGrade + "학년";
  }

  if (schoolClass === null) {
    classText.textContent = "반: 아직 저장하지 않음";
  } else {
    classText.textContent = "반: " + schoolClass + "반";
  }
}


//홈 화면에 저장된 학교 정보와 기본 시간표를 표시한다
function showHomePage() {
  //이 함수가 홈 화면에서 필요한 요소를 거의 다 담당함
  let schoolInformation = document.querySelector("#school_information");
  let loadingMessage = document.querySelector("#loading_message");
  let scheduleTable = document.querySelector("#schedule_malloc");
  let changedList = document.querySelector("#changed_schedule_list");

  let schoolName = localStorage.getItem(saveSchoolName);
  let schoolGrade = localStorage.getItem(saveSchoolGrade);
  let schoolClass = localStorage.getItem(saveSchoolClass);
  let todayNumber = getTodayNumber();
  let todayName = getTodayName(todayNumber);
  let basicSchedule = getBasicSchedule(todayNumber);

  if (schoolName === null) {
    //설정 페이지를 방문하지 않은 경우에도 화면이 깨지지 않게 기본값 사용
    schoolName = "아직 설정하지 않음";
  }

  if (schoolGrade === null) {
    schoolGrade = "-";
  }

  if (schoolClass === null) {
    schoolClass = "-";
  }

  //기능이 없는 이유를 사용자에게 바로 알려주는 문장
  loadingMessage.textContent = "컴시간 서버 연결이 차단되어 오늘 시간표 자동 조회 기능은 사용할 수 없습니다.";
  schoolInformation.innerHTML = "";

  let schoolLine = document.createElement("p");
  let classLine = document.createElement("p");
  //innerHTML로 한 번에 적는 것보다 배운 createElement를 사용해봄
  schoolLine.textContent = "학교: " + schoolName;
  classLine.textContent = "학급: " + schoolGrade + "학년 " + schoolClass + "반 / 표시 요일: " + todayName;
  schoolInformation.appendChild(schoolLine);
  schoolInformation.appendChild(classLine);

  //data.js에서 만든 예시 행을 지우고 1교시부터 7교시까지 다시 만든다
  scheduleTable.innerHTML = "";

  for (let i = 0; i < 7; i++) {
    //i는 0부터 시작하지만 화면에 보이는 교시는 1부터라 아래에서 +1을 한다
    let oneRow = document.createElement("tr");
    let periodCell = document.createElement("td");
    let basicCell = document.createElement("td");
    let todayCell = document.createElement("td");

    periodCell.textContent = i + 1 + "교시";

    if (basicSchedule[i] == "" || basicSchedule[i] === undefined) {
      //빈 칸으로 두면 저장이 안 된 건지 구분이 안 돼서 문구 표시
      basicCell.textContent = "아직 입력 안 함";
    } else {
      basicCell.textContent = basicSchedule[i];
    }

    todayCell.textContent = "자동 조회 불가";
    oneRow.appendChild(periodCell);
    oneRow.appendChild(basicCell);
    oneRow.appendChild(todayCell);
    scheduleTable.appendChild(oneRow);
  }

  changedList.innerHTML = "";
  //실시간 비교는 제거했으므로 목록 대신 안내 한 줄만 만든다
  let changedNotice = document.createElement("li");
  changedNotice.textContent = "오늘 시간표를 가져올 수 없어 자동 비교도 사용할 수 없습니다.";
  changedList.appendChild(changedNotice);
}


//현재 페이지에 있는 요소를 확인해서 필요한 기능만 실행한다
let schoolSaveButton = document.querySelector("#school_save_button");
let homeScheduleTable = document.querySelector("#schedule_malloc");

if (schoolSaveButton !== null) {
  //설정 페이지가 아닐 때는 버튼 자체가 없으므로 여기로 들어오지 않는다
  schoolSaveButton.addEventListener("click", function () {
    storeSchoolSetting();
  });

  showSchoolSetting();
}

if (homeScheduleTable !== null) {
  //홈에서만 학교 정보와 표를 그린다
  showHomePage();
}
