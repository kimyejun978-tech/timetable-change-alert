//slt_day 변수 선언 -> 1~5 월~금 상태 결정 default 값 -> 5
//그런식으로 해서? 약간 이케이케 해서 어떤 날의 시간표를 저장할건지..! 그걸 정하는 거임 ㅇㅇ
let setday = 5;


//월요일 기본 시간표 저장
function store_mon() {
  //한꺼번에 찾는 방법도 있겠지만 처음 짤 때 하나씩 찾는 게 이해하기 편했음
  const monc1 = document.querySelector("#c1");
  const monc2 = document.querySelector("#c2");
  const monc3 = document.querySelector("#c3");
  const monc4 = document.querySelector("#c4");
  const monc5 = document.querySelector("#c5");
  const monc6 = document.querySelector("#c6");
  const monc7 = document.querySelector("#c7");

  //요일마다 키 이름을 다르게 해두면 나중에 서로 섞이지 않음
  const smon = {
    mc1: monc1.value,
    mc2: monc2.value,
    mc3: monc3.value,
    mc4: monc4.value,
    mc5: monc5.value,
    mc6: monc6.value,
    mc7: monc7.value,
  };

  //객체 그대로는 저장이 안돼서 문자열로 바꿔서 넣는다
  localStorage.setItem("smon", JSON.stringify(smon));
}


//화요일 기본 시간표 저장
function store_tues() {
  //화요일도 월요일이랑 같은 구조인데 변수 이름만 구분함
  const tuesc1 = document.querySelector("#c1");
  const tuesc2 = document.querySelector("#c2");
  const tuesc3 = document.querySelector("#c3");
  const tuesc4 = document.querySelector("#c4");
  const tuesc5 = document.querySelector("#c5");
  const tuesc6 = document.querySelector("#c6");
  const tuesc7 = document.querySelector("#c7");

  const stues = {
    tuc1: tuesc1.value,
    tuc2: tuesc2.value,
    tuc3: tuesc3.value,
    tuc4: tuesc4.value,
    tuc5: tuesc5.value,
    tuc6: tuesc6.value,
    tuc7: tuesc7.value,
  };

  localStorage.setItem("stues", JSON.stringify(stues));
}


//수요일 기본 시간표 저장
function store_wed() {
  //수요일 입력창은 요일을 바꿀 때 새로 생기므로 저장할 때 다시 찾아야 함
  const wedc1 = document.querySelector("#c1");
  const wedc2 = document.querySelector("#c2");
  const wedc3 = document.querySelector("#c3");
  const wedc4 = document.querySelector("#c4");
  const wedc5 = document.querySelector("#c5");
  const wedc6 = document.querySelector("#c6");
  const wedc7 = document.querySelector("#c7");

  const swed = {
    wc1: wedc1.value,
    wc2: wedc2.value,
    wc3: wedc3.value,
    wc4: wedc4.value,
    wc5: wedc5.value,
    wc6: wedc6.value,
    wc7: wedc7.value,
  };

  localStorage.setItem("swed", JSON.stringify(swed));
}


//목요일 기본 시간표 저장
function store_thur() {
  //목요일은 th가 들어간 이름을 사용했다. 짧게 하려다 조금 애매해짐
  const thursc1 = document.querySelector("#c1");
  const thursc2 = document.querySelector("#c2");
  const thursc3 = document.querySelector("#c3");
  const thursc4 = document.querySelector("#c4");
  const thursc5 = document.querySelector("#c5");
  const thursc6 = document.querySelector("#c6");
  const thursc7 = document.querySelector("#c7");

  const sthur = {
    thc1: thursc1.value,
    thc2: thursc2.value,
    thc3: thursc3.value,
    thc4: thursc4.value,
    thc5: thursc5.value,
    thc6: thursc6.value,
    thc7: thursc7.value,
  };

  localStorage.setItem("sthurs", JSON.stringify(sthur));
}


//금요일 기본 시간표 저장
function store_fri() {
  //처음 화면이 금요일이라 페이지에 들어오면 이 입력칸들이 먼저 보임
  const fric1 = document.querySelector("#c1");
  const fric2 = document.querySelector("#c2");
  const fric3 = document.querySelector("#c3");
  const fric4 = document.querySelector("#c4");
  const fric5 = document.querySelector("#c5");
  const fric6 = document.querySelector("#c6");
  const fric7 = document.querySelector("#c7");

  const sfri = {
    fc1: fric1.value,
    fc2: fric2.value,
    fc3: fric3.value,
    fc4: fric4.value,
    fc5: fric5.value,
    fc6: fric6.value,
    fc7: fric7.value,
  };

  localStorage.setItem("sfri", JSON.stringify(sfri));
}



//비교 결과 페이지에서 변경된 시간표 표를 자동으로 만들어주는 부분
const scd = document.querySelector("#schedule_malloc");

if (scd !== null) {
  //표가 없는 페이지에서도 data.js를 쓰기 때문에 null 확인을 먼저 한다
  let row = 3;

  for (let i = 1; i <= row; i++) {
    const tr = document.createElement("tr");

    //처음 만들 때 화면 확인용으로 넣었던 기본 행. 홈에서는 main.js가 다시 바꾼다
    tr.innerHTML = `
      <td>${i}교시</td> 
      <td>변경 전 과목</td>
      <td>변경 후 과목</td>
    `;

    scd.appendChild(tr);
  }
}



//기본 시간표 입력 영역 선택
const scheduleArea = document.querySelector("#scheduleArea");

//편하게 사용을 위해 상수 선언을 다 해주고
const mon = document.querySelector(".mon");
const tues = document.querySelector(".tues");
const wednes = document.querySelector(".wednes");
const thurs = document.querySelector(".thurs");
const fri = document.querySelector(".fri");

const dayBtns = document.querySelectorAll(".day-btn");


//html을 매번 길게 쓰기 귀찮으니까 함수로 만들어둠
//dayName에 월요일, 화요일 이런 값이 들어가면 그 요일에 맞는 시간표 입력창 html을 반환해줌
function makeScheduleHTML(dayName) {
  //백틱을 쓰면 여러 줄 html을 그대로 적을 수 있어서 이 방식으로 함
  return `
    <h2>${dayName} 기본 시간표</h2>

    <form>
      <label>1교시 <input type="text" id="c1" placeholder="1교시 과목 입력"></label>
      <label>2교시 <input type="text" id="c2" placeholder="2교시 과목 입력"></label>
      <label>3교시 <input type="text" id="c3" placeholder="3교시 과목 입력"></label>
      <label>4교시 <input type="text" id="c4" placeholder="4교시 과목 입력"></label>
      <label>5교시 <input type="text" id="c5" placeholder="5교시 과목 입력"></label>
      <label>6교시 <input type="text" id="c6" placeholder="6교시 과목 입력"></label>
      <label>7교시 <input type="text" id="c7" placeholder="7교시 과목 입력"></label>

      <button type="button" class="store_slt">기본 시간표 저장</button>
    </form>
  `;
}


//요일 버튼을 클릭했을 때 실행되는 함수
//dayNumber는 월=1, 화=2, 수=3, 목=4, 금=5 이런식으로 저장되는 값
//dayName은 화면에 보여줄 요일 이름
//clickedBtn은 실제로 클릭된 버튼임
function selectDay(dayNumber, dayName, clickedBtn) {
  //일단 모든 요일 버튼에서 active를 제거함
  dayBtns.forEach(function (btn) {
    btn.classList.remove("active");
  });

  //클릭한 버튼에만 active를 붙여줌
  clickedBtn.classList.add("active");

  //아까 위에서 설정한 setday 그걸 클릭한 요일에 맞게 바꿔줌
  setday = dayNumber;

  //html을 이런식으로 바꿔줌
  scheduleArea.innerHTML = makeScheduleHTML(dayName);
}


//저장 버튼을 눌렀을 때 현재 setday 값에 따라 어떤 요일인지 판단하는 함수
function saveSelectedDay() {
  //setday 하나만 보고 어떤 저장 함수를 실행할지 고르는 부분
  if (setday == 1) {
    store_mon();
  } else if (setday == 2) {
    store_tues();
  } else if (setday == 3) {
    store_wed();
  } else if (setday == 4) {
    store_thur();
  } else if (setday == 5) {
    store_fri();
  }

  alert("기본 시간표가 저장되었습니다.");
}


//클릭이 된다하면
//scheduleArea가 있는 페이지, 즉 basic.html에서만 실행되게 함
if (scheduleArea !== null) {
  mon.addEventListener("click", function () {
    //월요일이므로 setday를 1로 설정해줌
    selectDay(1, "월요일", mon);
  });

  tues.addEventListener("click", function () {
    //화요일이므로 setday를 2로 설정해줌
    selectDay(2, "화요일", tues);
  });

  wednes.addEventListener("click", function () {
    //수요일이므로 setday를 3으로 설정해줌
    selectDay(3, "수요일", wednes);
  });

  thurs.addEventListener("click", function () {
    //목요일이므로 setday를 4로 설정해줌
    selectDay(4, "목요일", thurs);
  });

  fri.addEventListener("click", function () {
    //금요일이므로 setday를 5로 설정해줌
    selectDay(5, "금요일", fri);
  });


  //저장 버튼 클릭 처리
  scheduleArea.addEventListener("click", function (event) {
    //입력 영역이 새로 만들어져도 부모인 scheduleArea는 그대로라 여기서 클릭을 받는다
    if (event.target.classList.contains("store_slt")) {
      saveSelectedDay();
    }
  });


  //처음 화면 기본값
  selectDay(5, "금요일", fri);
}
