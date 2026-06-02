const scheduleArea = document.querySelector("#scheduleArea");

const mon = document.querySelector(".mon");
const tues = document.querySelector(".tues");
const wednes = document.querySelector(".wednes");
const thurs = document.querySelector(".thurs");
const fri = document.querySelector(".fri");

const dayBtns = document.querySelectorAll(".day-btn");

mon.addEventListener("click", function () {
  dayBtns.forEach(function (btn) {
    btn.classList.remove("active");
  });

  mon.classList.add("active");

  scheduleArea.innerHTML = `
    <h2>월요일 기본 시간표</h2>

    <form>
      <label>1교시 <input type="text" placeholder="1교시 과목 입력"></label>
      <label>2교시 <input type="text" placeholder="2교시 과목 입력"></label>
      <label>3교시 <input type="text" placeholder="3교시 과목 입력"></label>
      <label>4교시 <input type="text" placeholder="4교시 과목 입력"></label>
      <label>5교시 <input type="text" placeholder="5교시 과목 입력"></label>
      <label>6교시 <input type="text" placeholder="6교시 과목 입력"></label>
      <label>7교시 <input type="text" placeholder="7교시 과목 입력"></label>

      <button type="button">기본 시간표 저장</button>
    </form>
  `;
});

tues.addEventListener("click", function () {
  dayBtns.forEach(function (btn) {
    btn.classList.remove("active");
  });

  tues.classList.add("active");

  scheduleArea.innerHTML = `
    <h2>화요일 기본 시간표</h2>

    <form>
      <label>1교시 <input type="text" placeholder="1교시 과목 입력"></label>
      <label>2교시 <input type="text" placeholder="2교시 과목 입력"></label>
      <label>3교시 <input type="text" placeholder="3교시 과목 입력"></label>
      <label>4교시 <input type="text" placeholder="4교시 과목 입력"></label>
      <label>5교시 <input type="text" placeholder="5교시 과목 입력"></label>
      <label>6교시 <input type="text" placeholder="6교시 과목 입력"></label>
      <label>7교시 <input type="text" placeholder="7교시 과목 입력"></label>

      <button type="button">기본 시간표 저장</button>
    </form>
  `;
});

wednes.addEventListener("click", function () {
  dayBtns.forEach(function (btn) {
    btn.classList.remove("active");
  });

  wednes.classList.add("active");

  scheduleArea.innerHTML = `
    <h2>수요일 기본 시간표</h2>

    <form>
      <label>1교시 <input type="text" placeholder="1교시 과목 입력"></label>
      <label>2교시 <input type="text" placeholder="2교시 과목 입력"></label>
      <label>3교시 <input type="text" placeholder="3교시 과목 입력"></label>
      <label>4교시 <input type="text" placeholder="4교시 과목 입력"></label>
      <label>5교시 <input type="text" placeholder="5교시 과목 입력"></label>
      <label>6교시 <input type="text" placeholder="6교시 과목 입력"></label>
      <label>7교시 <input type="text" placeholder="7교시 과목 입력"></label>

      <button type="button">기본 시간표 저장</button>
    </form>
  `;
});

thurs.addEventListener("click", function () {
  dayBtns.forEach(function (btn) {
    btn.classList.remove("active");
  });

  thurs.classList.add("active");

  scheduleArea.innerHTML = `
    <h2>목요일 기본 시간표</h2>

    <form>
      <label>1교시 <input type="text" placeholder="1교시 과목 입력"></label>
      <label>2교시 <input type="text" placeholder="2교시 과목 입력"></label>
      <label>3교시 <input type="text" placeholder="3교시 과목 입력"></label>
      <label>4교시 <input type="text" placeholder="4교시 과목 입력"></label>
      <label>5교시 <input type="text" placeholder="5교시 과목 입력"></label>
      <label>6교시 <input type="text" placeholder="6교시 과목 입력"></label>
      <label>7교시 <input type="text" placeholder="7교시 과목 입력"></label>

      <button type="button">기본 시간표 저장</button>
    </form>
  `;
});

fri.addEventListener("click", function () {
  dayBtns.forEach(function (btn) {
    btn.classList.remove("active");
  });

  fri.classList.add("active");

  scheduleArea.innerHTML = `
    <h2>금요일 기본 시간표</h2>

    <form>
      <label>1교시 <input type="text" placeholder="1교시 과목 입력"></label>
      <label>2교시 <input type="text" placeholder="2교시 과목 입력"></label>
      <label>3교시 <input type="text" placeholder="3교시 과목 입력"></label>
      <label>4교시 <input type="text" placeholder="4교시 과목 입력"></label>
      <label>5교시 <input type="text" placeholder="5교시 과목 입력"></label>
      <label>6교시 <input type="text" placeholder="6교시 과목 입력"></label>
      <label>7교시 <input type="text" placeholder="7교시 과목 입력"></label>

      <button type="button">기본 시간표 저장</button>
    </form>
  `;
});