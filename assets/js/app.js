let finalData = [];

function cleanName(name) {
    if (!name) return "";
    name = name.replace(/^(Mr\.?|Ms\.?|Mrs\.?)\s+/i, "");
    return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeKeys(row) {
    let newRow = {};
    Object.keys(row).forEach(key => {
        newRow[key.trim().toLowerCase()] = row[key];
    });
    return newRow;
}

function mapColumns(row) {
    if (row["product identification number"]) {
        row["container number"] = row["product identification number"];
    }
    return row;
}

function fillMergedCells(data, columnName) {
    let lastValue = "";
    data.forEach(row => {
        if (row[columnName]) lastValue = row[columnName];
        else row[columnName] = lastValue;
    });
}

function formatMoney(num) {
    return Number.isInteger(num) ? num : parseFloat(num.toFixed(2));
}

function processFiles() {
    const file1 = document.getElementById("file1").files[0];
    const file2 = document.getElementById("file2").files[0];

    if (!file1 || !file2) {
        alert("Upload both files first.");
        return;
    }

    if (file1.name !== "payment info sheet.xlsx") {
        alert('File must be named: payment info sheet.xlsx');
        return;
    }

    if (file2.name !== "deduction list.xlsx") {
        alert('File must be named: deduction list.xlsx');
        return;
    }

    Promise.all([readFile(file1), readFile(file2)])
    .then(([data1, data2]) => {

        data1 = data1.map(normalizeKeys).map(mapColumns);
        data2 = data2.map(normalizeKeys).map(mapColumns);

        fillMergedCells(data1, "container number");
        fillMergedCells(data1, "client name");
        fillMergedCells(data2, "container number");
        fillMergedCells(data2, "client name");

        // Fill insurance paid down merged cells per container group
        // Only fill if the container number is the same as the previous row
        let lastContainer = "";
        let lastInsurance = "";
        data2.forEach(row => {
            let container = String(row["container number"]).trim().toUpperCase();
            let insurance = row["insurance paid"];

            if (container === lastContainer) {
                // Same container — if insurance is empty, carry down the last value
                if (!insurance && insurance !== 0) {
                    row["insurance paid"] = lastInsurance;
                } else {
                    lastInsurance = insurance;
                }
            } else {
                // New container — reset
                lastContainer = container;
                lastInsurance = insurance;
            }
        });

        // Count how many unique clients share each container
        let containerClients = {};
        data2.forEach(row => {
            let container = String(row["container number"]).trim().toUpperCase();
            let name = cleanName(row["client name"]);
            if (!container) return;
            if (!containerClients[container]) containerClients[container] = new Set();
            containerClients[container].add(name);
        });

        // Check if insurance is paid per container (any value > 0 = paid)
        let containerInsurancePaid = {};
        data2.forEach(row => {
            let container = String(row["container number"]).trim().toUpperCase();
            let paid = Number(row["insurance paid"]) || 0;
            if (!containerInsurancePaid[container]) containerInsurancePaid[container] = 0;
            containerInsurancePaid[container] += paid;
        });

        // Group rows by client + IBAN
        let grouped = {};
        data2.forEach(row => {
            let name = cleanName(row["client name"]);
            let iban = (row["iban"] || "").replace(/\s/g, "");
            let container = String(row["container number"]).trim().toUpperCase();
            let key = name + "_" + iban;

            if (!grouped[key]) {
                grouped[key] = {
                    name: name,
                    iban: iban,
                    containers: [],
                    balance: (row["balance amount pending to be paid"] || "")
                };
            }

            grouped[key].containers.push(container);
        });

        finalData = [];

        for (let key of Object.keys(grouped)) {
            let data = grouped[key];
            let name = data.name;
            let iban = data.iban;

            let shared = false;
            let insurancePaid = 0;
            let insuranceRequired = 0;
            let units = 0;

            // Use a set to avoid double-counting containers
            let seenContainers = new Set();

            data.containers.forEach(container => {
                if (seenContainers.has(container)) return;
                seenContainers.add(container);

                let shareCount = containerClients[container] ? containerClients[container].size : 1;
                if (shareCount > 1) shared = true;

                let totalPaidForContainer = containerInsurancePaid[container] || 0;

                if (totalPaidForContainer > 0) {
                    // Insurance already paid for this container
                    insurancePaid += totalPaidForContainer / shareCount;
                    insuranceRequired += 0;
                } else {
                    // Insurance not paid — required amount is divided equally
                    insurancePaid += 0;
                    insuranceRequired += 1500 / shareCount;
                }

                units += 1 / shareCount;
            });

            let notes = [];
            if (insuranceRequired > 0) {
                if (shared) {
                    notes.push("Shared Container");
                    notes.push(Array.from(seenContainers).join(", "));
                }
                notes.push("Insurance deduction");
            } else {
                notes.push("No deduction");
            }
            if (data.balance) notes.push("| " + data.balance);

            finalData.push({
                "Client Name": name,
                "IBAN": iban,
                "Units": formatMoney(units),
                "Insurance Paid": formatMoney(insurancePaid),
                "Additional": "",
                "Insurance Required": formatMoney(insuranceRequired),
                "Notes": notes.join(" ")
            });
        }

        downloadExcel();
    });
}

function readFile(file) {
    return new Promise((resolve) => {
        let reader = new FileReader();
        reader.onload = function (e) {
            let data = new Uint8Array(e.target.result);
            let workbook = XLSX.read(data, { type: "array" });
            let sheet = workbook.Sheets[workbook.SheetNames[0]];
            resolve(XLSX.utils.sheet_to_json(sheet));
        };
        reader.readAsArrayBuffer(file);
    });
}

function downloadExcel() {
    let worksheet = XLSX.utils.json_to_sheet(finalData);
    let workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "IP Deduction Report");

    let now = new Date();
    let fileName = `IP_Deduction_Report_${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}.xlsx`;

    XLSX.writeFile(workbook, fileName);
}