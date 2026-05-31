const scd = document.querySelector("#schedule_malloc");

let row = 3;

for (let i = 0; i <= row; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
    <td>${1}교시</td>
    <td>변경 전 과목</td>
    <td>변경 후 과목</td>
    `;
    scd.appendChild(tr);
}