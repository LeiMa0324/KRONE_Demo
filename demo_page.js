//read demo_data.csv and return a 2D array
async function readCSV() {
    const response = await fetch('./data/demo_data.csv'); // Fetch the CSV file
    const csvText = await response.text(); // Read the file as text
    const rows = csvText.split('\n'); // Split the text into rows

    // Parse each row, accounting for quoted strings
    const data = rows.map(row => {
        const regex = /"([^"]*)"|([^,]+)/g; // Match quoted strings or unquoted values
        const matches = [];
        let match;
        while ((match = regex.exec(row)) !== null) {
            matches.push(match[1] || match[2]); // Use the quoted value or the unquoted value
        }
        return matches;
    });

    return data; // Return the 2D array
}

// Append possible options to the dropdown bar
function getOptions(data) {
    console.log(data.length);
    dropDownBar = document.getElementById('dropdown-bar');
    for (let i = 1; i < data.length-1; i++) {
        optionChild = document.createElement('option');
        optionChild.value = "option" + data[i][0]; // Set the value of the option
        optionChild.textContent = "Option " + data[i][0];
        dropDownBar.appendChild(optionChild); // Append the option to the dropdown
    }
}

//Clear table data
function clearTable() {
    const table = document.getElementById('data-table');
    // Remove all rows except the header row
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }
}

// parse the log sequence
function parseSequence(sequence) {
    return sequence
        .replace(/[\[\]]/g, '') // Remove square brackets
        .split(',') // Split by commas
        .map(item => item.trim()); // Trim whitespace from each element
}

//Append option data to table : takes a 1d array representing the option as input
function appendOptionData(data) {
    table = document.getElementById('data-table');

    let sequence = parseSequence(data[1]);
    console.log(sequence);

    //append parsed log sequence to the table
    for (let i = 0; i < sequence.length; i++) {
        let row = table.insertRow(-1); // Insert a new row at the end of the table
        let index = document.createElement('td');
        let logMessage = document.createElement('td');
        let explanation = document.createElement('td');

        index.textContent = i + 1; // Set the index cell
        logMessage.textContent = sequence[i]; // Set the log message cell
        explanation.textContent = ""; // Set the explanation cell
        row.appendChild(index); // Append the index cell to the row
        row.appendChild(logMessage); // Append the log message cell to the row
        row.appendChild(explanation); // Append the explanation cell to the row
    }

    //Update anomaly display
    anomalyDisplay = document.getElementById('prediction');
    data[2] == 1 ? anomalyDisplay.textContent = "Anomaly Found" : anomalyDisplay.textContent = "No Anomaly Found";

    // if sequence is anomaly merge cells of corresponding rows and last columns and add anomaly explanation
    if (data[2] === "1") {
        let anomalyRange = parseSequence(data[4]);
        let startIndex = parseInt(anomalyRange[0], 10); // Convert to zero-based index
        let endIndex = parseInt(anomalyRange[1], 10); // Convert to zero-based index

        console.log(startIndex, endIndex);
        for (let i = startIndex; i <= endIndex; i++) {
            let row = table.rows[i+1];
            row.style.backgroundColor = "orange"; // Highlight the row
        }

        // Merge the last column cells in the anomaly range
        const firstRow = table.rows[startIndex + 1]; // Adjust for header row
        const explanationCell = firstRow.cells[2]; // Last column (explanation)
        explanationCell.rowSpan = endIndex - startIndex + 1; // Set the row span
        explanationCell.textContent = data[3]; // Set the anomaly explanation

        // Remove the explanation cells from the merged rows
        for (let i = startIndex + 1; i <= endIndex; i++) {
            const row = table.rows[i + 1]; // Adjust for header row
            row.deleteCell(2); // Remove the last column cell
        }
        
        return;
    }
}

//Initalize page content with data from demo_data.csv
(async function initPage() {
    const curData = await readCSV();
    getOptions(curData);
    console.log(curData);

    // Add event listener to the submit button
    document.querySelector('.run-option').addEventListener('click', () => {
        const dropDownBar = document.getElementById('dropdown-bar');
        const selectedIndex = dropDownBar.selectedIndex; // Get the selected index

        const selectedOption = dropDownBar.options[selectedIndex].value; // Get the selected value

        // Extract the option index from the value (e.g., "option0" -> 0)
        const optionIndex = parseInt(selectedOption.replace('option', ''), 10);

        // Clear the table and append data for the selected option
        clearTable();
        appendOptionData(curData[optionIndex+1]);
    });

})();