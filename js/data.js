const scd = document.querySelector("#schedule_malloc");

let row = 3;

for (let i = 1; i <= row; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
    <td>${i}교시</td>
    <td>변경 전 과목</td>
    <td>변경 후 과목</td>
    `;
    scd.appendChild(tr);
}