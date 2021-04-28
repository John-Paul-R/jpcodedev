
(function(){
const container = document.getElementById("widget_content");
const c_table = container.getElementsByTagName('table')[0];
const tbody = container.getElementsByTagName('tbody')[0];

const children = Array.from(tbody.children);

const sorted = children.sort((a, b) => new Date(b.getAttribute("data-session-date")).getTime() - new Date(a.getAttribute("data-session-date")).getTime())
for (let i = 0; i < sorted.length; i++) {
    sorted[i].orderNum = i;
}

function sortTable() {
    var table, rows, switching, i, x, y, shouldSwitch;
    table = c_table;
    switching = true;
    /*Make a loop that will continue until
    no switching has been done:*/
    while (switching) {
      //start by saying: no switching is done:
      switching = false;
      rows = table.rows;
      console.log(rows);
      /*Loop through all table rows (except the
      first, which contains table headers):*/
      for (i = 1; i < (rows.length - 1); i++) {
        //start by saying there should be no switching:
        shouldSwitch = false;
        /*Get the two elements you want to compare,
        one from current row and one from the next:*/
        x = rows[i];
        y = rows[i + 1];
        //check if the two rows should switch place:
        console.log(x.orderNum)
        if (x.orderNum > y.orderNum) {
          //if so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      }
      if (shouldSwitch) {
        /*If a switch has been marked, make the switch
        and mark that a switch has been done:*/
        rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
        switching = true;
      }
    }
  }
  sortTable();
  console.log(sorted);
})();

