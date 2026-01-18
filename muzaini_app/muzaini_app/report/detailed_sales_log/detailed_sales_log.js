// Copyright (c) 2026, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["Detailed Sales Log"] = {
	filters: [
		{
			fieldname: "company",
			label: __("الشركة"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
			reqd: 1,
			width: "200px",
		},
		{
			fieldname: "customer",
			label: __("العميل"),
			fieldtype: "Link",
			options: "Customer",
			width: "200px",
			get_query: function () {
				return {
					filters: [["Customer", "disabled", "=", 0]],
				};
			},
		},
		{
			fieldname: "from_date",
			label: __("من تاريخ"),
			fieldtype: "Date",
			default: frappe.datetime.add_months(frappe.datetime.get_today(), -1),
			reqd: 1,
			width: "100px",
		},
		{
			fieldname: "to_date",
			label: __("إلى تاريخ"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
			reqd: 1,
			width: "100px",
		},
		{
			fieldname: "from_time",
			label: __("من وقت"),
			fieldtype: "Time",
			default: "00:00:00",
			reqd: 1,
			width: "100px",
		},
		{
			fieldname: "to_time",
			label: __("إلى وقت"),
			fieldtype: "Time",
			default: "23:59:59",
			reqd: 1,
			width: "100px",
		},
		{
			fieldname: "pos_profile",
			label: __("نقطة البيع"),
			fieldtype: "Link",
			options: "POS Profile",
			width: "150px",
		},
		{
			fieldname: "owner",
			label: __("المستخدم"),
			fieldtype: "Link",
			options: "User",
			width: "150px",
		},
		{
			fieldname: "warehouse",
			label: __("المستودع"),
			fieldtype: "Link",
			options: "Warehouse",
			width: "150px",
		},
		{
			fieldname: "mode_of_payment",
			label: __("طريقة الدفع"),
			fieldtype: "Link",
			options: "Mode of Payment",
			width: "150px",
		},
		{
			fieldname: "cost_center",
			label: __("مركز التكلفة"),
			fieldtype: "Link",
			options: "Cost Center",
			width: "150px",
		},
		{
			fieldname: "status",
			label: __("حالة الفاتورة"),
			fieldtype: "Select",
			options: "\nPaid\nUnpaid\nPartly Paid\nOverdue\nCredit Note Issued\nReturn",
			width: "150px",
		},
		{
			fieldname: "show_credit_returns",
			label: __("إظهار مرتجعات الفواتير الآجلة فقط"),
			fieldtype: "Check",
			default: 0,
			width: "200px",
			onchange: function () {
				console.log("Credit returns filter changed");
			},
		},
	],
	formatter: function (value, row, column, data, default_formatter) {
		if (data) {
			// Avoid showing "null" in any column
			if (value === null || value === "null") {
				value = "";
			}

			// Format document type column - translate types to Arabic
			if (column.fieldname === "voucher_type") {
				switch (value) {
					case "Sales Invoice":
						return "فاتورة مبيعات";
					case "Payment Entry":
						return "سند قبض";
					case "Journal Entry":
						return "قيد محاسبي";
					case "Purchase Invoice":
						return "فاتورة مشتريات";
					default:
						return value || "";
				}
			}

			// Format invoice status - with color coding
			if (column.fieldname === "invoice_status") {
				if (!value) return "";

				let color = "black";
				if (value.includes("مرتجع")) {
					color = "red";
				} else if (value.includes("نقدية") || value.includes("مسددة بالكامل")) {
					color = "green";
				} else if (value.includes("غير مسددة") || value.includes("متأخرة")) {
					color = "orange";
				} else if (value.includes("مسددة جزئياً")) {
					color = "blue";
				} else if (value.includes("ملغية")) {
					color = "gray";
				}

				return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
			}

			// Format for return_against column - add link to original invoice
			if (column.fieldname === "return_against" && value) {
				return `<a href="/app/sales-invoice/${value}" target="_blank">${value}</a>`;
			}

			// Format for credit return status - highlight with a badge
			if (column.fieldname === "credit_return_status" && value) {
				return `<span class="indicator-pill red" style="font-size: 0.8em; padding: 3px 8px; white-space: nowrap; display: inline-block;">${value}</span>`;
			}

			// Format for amount columns
			if (column.fieldname === "grand_total" || column.fieldname === "tax_amount") {
				return (
					'<span style="font-weight: bold;">' +
					default_formatter(value, row, column, data) +
					"</span>"
				);
			}

			// Basic format for totals
			if (data.is_total_row) {
				return (
					'<span style="font-weight: bold;">' +
					default_formatter(value, row, column, data) +
					"</span>"
				);
			}
		}

		return default_formatter(value || "", row, column, data);
	},

	onload: function (report) {
		console.log("تم تحميل تقرير سجل المبيعات المفصل");

		// Add custom CSS
		$(
			"<style>\
            .datatable .dt-cell { padding: 0px !important; }\
            .datatable .dt-row { border-bottom: 1px solid #eee; }\
            .datatable .dt-header .dt-cell { background-color: #f5f7fa; font-weight: bold; }\
            .sales-summary-section { direction: rtl; }\
            .summary-card { background-color: #f8f8f8; border-radius: 5px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }\
            .summary-card-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; }\
            .summary-amount { font-size: 20px; font-weight: bold; }\
            .summary-card.total { border-right: 5px solid #4272d7; }\
            .summary-card.invoice-count { border-right: 5px solid #28a745; }\
            .summary-card.payment-method { border-right: 5px solid #fd7e14; }\
            .summary-card.credit-returns { border-right: 5px solid #dc3545; }\
            .total-amount { color: #4272d7; }\
            .invoice-count-value { color: #28a745; }\
            .payment-method-value { color: #fd7e14; }\
            .credit-returns-value { color: #dc3545; }\
            .indicator-pill.red { background-color: #dc3545; color: white; padding: 3px 8px; border-radius: 10px; font-size: 0.8em; }\
            .credit-return-row { background-color: #fff0f0; }\
        </style>",
		).appendTo("head");

		// Create sales summary section
		var $salesSummarySection = $(
			'<div class="sales-summary-section" style="margin-bottom: 20px; padding: 20px; background-color: #fff; border: 1px solid #ddd; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);"></div>',
		);
		var $salesSummaryHeader = $(
			'<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;"><h3 style="margin: 0; color: #333; font-weight: bold;">' +
				__("ملخص سجل المبيعات المفصل") +
				'</h3><div class="report-date"></div></div>',
		);

		// Create row for summary cards
		var $summaryCardsSection = $(
			'<div class="summary-cards" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;"></div>',
		);

		// Create summary cards
		var $totalCard = $(
			'<div class="summary-card total" style="flex: 1;"><div class="summary-card-title">' +
				__("إجمالي المبيعات") +
				'</div><div class="summary-amount total-amount"></div></div>',
		);
		var $invoiceCountCard = $(
			'<div class="summary-card invoice-count" style="flex: 1;"><div class="summary-card-title">' +
				__("عدد الفواتير") +
				'</div><div class="summary-amount invoice-count-value"></div></div>',
		);
		var $paymentMethodsCard = $(
			'<div class="summary-card payment-method" style="flex: 1;"><div class="summary-card-title">' +
				__("طرق الدفع") +
				'</div><div class="summary-amount payment-method-value"></div></div>',
		);
		var $creditReturnsCard = $(
			'<div class="summary-card credit-returns" style="flex: 1;"><div class="summary-card-title">' +
				__("مرتجعات الفواتير الآجلة غير المسددة") +
				'</div><div class="summary-amount credit-returns-value">0</div></div>',
		);

		$summaryCardsSection
			.append($totalCard)
			.append($invoiceCountCard)
			.append($paymentMethodsCard)
			.append($creditReturnsCard);

		// Create sales details section
		var $salesDetailsSection = $(
			'<div class="sales-details" style="margin-top: 20px;"></div>',
		);

		$salesSummarySection
			.append($salesSummaryHeader)
			.append($summaryCardsSection)
			.append($salesDetailsSection);

		// Add section to the top of the report after filters
		if (report.page.main.find(".sales-summary-section").length === 0) {
			report.page.main.find(".report-filter-section").after($salesSummarySection);
		}

		// Watch for filter changes
		report.page.main.find('[data-fieldname="show_credit_returns"]').on("change", function () {
			var isChecked = $(this).is(":checked");
			console.log("Credit returns filter changed:", isChecked);
			// Force refresh when this filter changes
			report.refresh();
		});

		// Check if the filter for credit returns exists
		checkFiltersIncludesCreditReturnOption();

		// Add custom row styling for credit returns
		function applyCreditReturnStyling() {
			setTimeout(function () {
				$(".datatable .dt-row").each(function () {
					var $row = $(this);
					// Look for credit return status
					var hasCreditReturn =
						$row.find(".indicator-pill.red").length > 0 ||
						$row.find('td:contains("فاتورة آجلة")').length > 0 ||
						$row.find('td:contains("فاتورة آجلة غير مسددة")').length > 0;

					if (hasCreditReturn) {
						$row.addClass("credit-return-row");
					}
				});
			}, 100);
		}

		// Update sales summary when data is loaded
		var originalRefresh = report.refresh;
		report.refresh = function () {
			originalRefresh.call(this);

			// Check if data is available
			if (report.data && report.data.length > 0) {
				// Get current filters
				const filters = report.get_values();

				// Store original data first
				let originalData = JSON.parse(JSON.stringify(report.data));

				// Apply filter for credit returns
				if (filters.show_credit_returns) {
					console.log("Filtering for credit returns only");

					// When checkbox is checked, filter for returns against credit invoices
					report.data = originalData.filter((row) => {
						return (
							row.credit_return_status !== null &&
							row.credit_return_status !== undefined &&
							row.credit_return_status !== "" &&
							row.is_credit_return === 1
						); // Use the new field we added for more reliable filtering
					});

					console.log("Filtered data length:", report.data.length);

					// If no data found after filtering, show message
					if (report.data.length === 0) {
						frappe.msgprint({
							title: __("لا توجد بيانات"),
							message: __("لم يتم العثور على مرتجعات لفواتير آجلة للفترة المحددة"),
							indicator: "orange",
						});
					}
				} else {
					// When unchecked, show all data
					report.data = originalData;
				}

				// ALWAYS refresh the table after filtering
				report.render_datatable();

				// Apply styling after rendering
				applyCreditReturnStyling();

				// Update summary
				updateSalesSummary(report.data, filters);
			}
		};

		// Function to check if the main filters include the new "show_credit_returns" option
		function checkFiltersIncludesCreditReturnOption() {
			// Check if the filter already exists
			var hasCreditReturnsFilter = false;
			if (frappe.query_reports["Detailed Sales Log"].filters) {
				frappe.query_reports["Detailed Sales Log"].filters.forEach(function (filter) {
					if (filter.fieldname === "show_credit_returns") {
						hasCreditReturnsFilter = true;
					}
				});
			}

			// If the filter doesn't exist, add it
			if (!hasCreditReturnsFilter) {
				frappe.query_reports["Detailed Sales Log"].filters.push({
					fieldname: "show_credit_returns",
					label: __("إظهار مرتجعات الفواتير الآجلة فقط"),
					fieldtype: "Check",
					default: 0,
					width: "200px",
					onchange: function () {
						console.log("Credit returns filter changed");
					},
				});
			}
		}

		// Function to update sales summary
		function updateSalesSummary(data, filters) {
			// Update report date
			$(".report-date").html(
				`<span style="font-size: 14px;">${__("تاريخ التقرير")}: ${formatDate(frappe.datetime.get_today())} ${formatTime(frappe.datetime.now_time())}</span>`,
			);

			// Calculate totals - excluding the total row we add
			var totalAmount = 0;
			var invoiceCount = 0;
			var paymentMethods = new Set();
			var posProfiles = new Set();
			var users = new Set();
			var warehouses = new Set();
			var creditReturnsCount = 0;

			data.forEach(function (row) {
				if (!row.is_total_row) {
					totalAmount += flt(row.grand_total);
					invoiceCount++;
					if (row.mode_of_payment && row.mode_of_payment !== "غير محدد") {
						paymentMethods.add(row.mode_of_payment);
					}
					if (row.pos_profile && row.pos_profile !== "غير محدد") {
						posProfiles.add(row.pos_profile);
					}
					if (row.owner && row.owner !== "غير محدد") {
						users.add(row.owner);
					}
					if (row.warehouse && row.warehouse !== "غير محدد") {
						warehouses.add(row.warehouse);
					}
					if (row.credit_return_status) {
						creditReturnsCount++;
					}
				}
			});

			// Update summary cards
			$(".total-amount").text(format_currency(totalAmount));
			$(".invoice-count-value").text(invoiceCount);
			$(".payment-method-value").text(paymentMethods.size);
			$(".credit-returns-value").text(creditReturnsCount);

			// Update sales details
			$(".sales-details").empty();

			// Create simple data analysis
			var paymentMethodsData = {};
			var invoiceStatuses = {};
			var costCenters = {};
			var posProfilesData = {};
			var usersData = {};
			var warehousesData = {};
			var creditReturnsData = {};

			data.forEach(function (row) {
				if (!row.is_total_row) {
					// Group by payment method
					if (row.mode_of_payment) {
						if (!paymentMethodsData[row.mode_of_payment]) {
							paymentMethodsData[row.mode_of_payment] = {
								count: 0,
								amount: 0,
							};
						}
						paymentMethodsData[row.mode_of_payment].count++;
						paymentMethodsData[row.mode_of_payment].amount += flt(row.grand_total);
					}

					// Group by invoice status
					if (row.invoice_status) {
						if (!invoiceStatuses[row.invoice_status]) {
							invoiceStatuses[row.invoice_status] = {
								count: 0,
								amount: 0,
							};
						}
						invoiceStatuses[row.invoice_status].count++;
						invoiceStatuses[row.invoice_status].amount += flt(row.grand_total);
					}

					// Group by cost center
					if (row.cost_center) {
						if (!costCenters[row.cost_center]) {
							costCenters[row.cost_center] = {
								count: 0,
								amount: 0,
							};
						}
						costCenters[row.cost_center].count++;
						costCenters[row.cost_center].amount += flt(row.grand_total);
					}

					// Group by POS profile
					if (row.pos_profile) {
						if (!posProfilesData[row.pos_profile]) {
							posProfilesData[row.pos_profile] = {
								count: 0,
								amount: 0,
							};
						}
						posProfilesData[row.pos_profile].count++;
						posProfilesData[row.pos_profile].amount += flt(row.grand_total);
					}

					// Group by user
					if (row.owner) {
						if (!usersData[row.owner]) {
							usersData[row.owner] = {
								count: 0,
								amount: 0,
							};
						}
						usersData[row.owner].count++;
						usersData[row.owner].amount += flt(row.grand_total);
					}

					// Group by warehouse
					if (row.warehouse) {
						if (!warehousesData[row.warehouse]) {
							warehousesData[row.warehouse] = {
								count: 0,
								amount: 0,
							};
						}
						warehousesData[row.warehouse].count++;
						warehousesData[row.warehouse].amount += flt(row.grand_total);
					}

					// Group by credit return status
					if (row.credit_return_status && row.return_against) {
						if (!creditReturnsData[row.return_against]) {
							creditReturnsData[row.return_against] = {
								count: 0,
								amount: 0,
								voucher_nos: [],
							};
						}
						creditReturnsData[row.return_against].count++;
						creditReturnsData[row.return_against].amount += flt(row.grand_total);
						creditReturnsData[row.return_against].voucher_nos.push(row.voucher_no);
					}
				}
			});

			// Display data analysis
			var $analysisSection = $('<div style="margin-top: 20px;"></div>');

			// Analysis by credit returns (if there are any)
			if (Object.keys(creditReturnsData).length > 0) {
				$analysisSection.append(
					'<h4 style="margin-bottom: 15px; color: #dc3545; font-weight: bold;">' +
						__("مرتجعات الفواتير الآجلة غير المسددة") +
						" (" +
						Object.keys(creditReturnsData).length +
						")" +
						"</h4>",
				);
				var $creditReturnsTable = $(
					'<table class="table table-bordered" style="width: 100%; margin-bottom: 20px; border: 2px solid #dc3545;"><thead style="background-color: #fff5f5;"><tr><th>' +
						__("الفاتورة الأصلية") +
						"</th><th>" +
						__("عدد المرتجعات") +
						"</th><th>" +
						__("مبلغ المرتجعات") +
						"</th><th>" +
						__("مستندات المرتجعات") +
						"</th></tr></thead><tbody></tbody></table>",
				);

				Object.keys(creditReturnsData).forEach(function (invoiceNo) {
					var returnLinks = creditReturnsData[invoiceNo].voucher_nos
						.map(function (voucherNo) {
							return `<a href="/app/sales-invoice/${voucherNo}" target="_blank">${voucherNo}</a>`;
						})
						.join(", ");

					$creditReturnsTable.find("tbody").append(`<tr>
                        <td><a href="/app/sales-invoice/${invoiceNo}" target="_blank">${invoiceNo}</a></td>
                        <td>${creditReturnsData[invoiceNo].count}</td>
                        <td>${format_currency(Math.abs(creditReturnsData[invoiceNo].amount))}</td>
                        <td>${returnLinks}</td>
                    </tr>`);
				});

				$analysisSection.append($creditReturnsTable);
			}

			// Analysis by payment method
			if (Object.keys(paymentMethodsData).length > 0) {
				$analysisSection.append(
					'<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' +
						__("التحليل حسب طريقة الدفع") +
						"</h4>",
				);
				var $paymentMethodsTable = $(
					'<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' +
						__("طريقة الدفع") +
						"</th><th>" +
						__("عدد الفواتير") +
						"</th><th>" +
						__("المبلغ") +
						"</th></tr></thead><tbody></tbody></table>",
				);

				Object.keys(paymentMethodsData).forEach(function (method) {
					$paymentMethodsTable
						.find("tbody")
						.append(
							"<tr><td>" +
								method +
								"</td><td>" +
								paymentMethodsData[method].count +
								"</td><td>" +
								format_currency(paymentMethodsData[method].amount) +
								"</td></tr>",
						);
				});

				$analysisSection.append($paymentMethodsTable);
			}

			// Analysis by invoice status
			if (Object.keys(invoiceStatuses).length > 0) {
				$analysisSection.append(
					'<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' +
						__("التحليل حسب حالة الفاتورة") +
						"</h4>",
				);
				var $invoiceStatusesTable = $(
					'<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' +
						__("حالة الفاتورة") +
						"</th><th>" +
						__("عدد الفواتير") +
						"</th><th>" +
						__("المبلغ") +
						"</th></tr></thead><tbody></tbody></table>",
				);

				Object.keys(invoiceStatuses).forEach(function (status) {
					$invoiceStatusesTable
						.find("tbody")
						.append(
							"<tr><td>" +
								status +
								"</td><td>" +
								invoiceStatuses[status].count +
								"</td><td>" +
								format_currency(invoiceStatuses[status].amount) +
								"</td></tr>",
						);
				});

				$analysisSection.append($invoiceStatusesTable);
			}

			// Analysis for other categories...
			if (Object.keys(costCenters).length > 0) {
				$analysisSection.append(
					'<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' +
						__("التحليل حسب مركز التكلفة") +
						"</h4>",
				);
				var $costCentersTable = $(
					'<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' +
						__("مركز التكلفة") +
						"</th><th>" +
						__("عدد الفواتير") +
						"</th><th>" +
						__("المبلغ") +
						"</th></tr></thead><tbody></tbody></table>",
				);

				Object.keys(costCenters).forEach(function (center) {
					$costCentersTable
						.find("tbody")
						.append(
							"<tr><td>" +
								center +
								"</td><td>" +
								costCenters[center].count +
								"</td><td>" +
								format_currency(costCenters[center].amount) +
								"</td></tr>",
						);
				});

				$analysisSection.append($costCentersTable);
			}

			// Analysis by POS profile
			if (Object.keys(posProfilesData).length > 0) {
				$analysisSection.append(
					'<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' +
						__("التحليل حسب نقطة البيع") +
						"</h4>",
				);
				var $posProfilesTable = $(
					'<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' +
						__("نقطة البيع") +
						"</th><th>" +
						__("عدد الفواتير") +
						"</th><th>" +
						__("المبلغ") +
						"</th></tr></thead><tbody></tbody></table>",
				);

				Object.keys(posProfilesData).forEach(function (profile) {
					$posProfilesTable
						.find("tbody")
						.append(
							"<tr><td>" +
								profile +
								"</td><td>" +
								posProfilesData[profile].count +
								"</td><td>" +
								format_currency(posProfilesData[profile].amount) +
								"</td></tr>",
						);
				});

				$analysisSection.append($posProfilesTable);
			}

			// Analysis by user
			if (Object.keys(usersData).length > 0) {
				$analysisSection.append(
					'<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' +
						__("التحليل حسب المستخدم") +
						"</h4>",
				);
				var $usersTable = $(
					'<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' +
						__("المستخدم") +
						"</th><th>" +
						__("عدد الفواتير") +
						"</th><th>" +
						__("المبلغ") +
						"</th></tr></thead><tbody></tbody></table>",
				);

				Object.keys(usersData).forEach(function (user) {
					$usersTable
						.find("tbody")
						.append(
							"<tr><td>" +
								user +
								"</td><td>" +
								usersData[user].count +
								"</td><td>" +
								format_currency(usersData[user].amount) +
								"</td></tr>",
						);
				});

				$analysisSection.append($usersTable);
			}

			// Analysis by warehouse
			if (Object.keys(warehousesData).length > 0) {
				$analysisSection.append(
					'<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' +
						__("التحليل حسب المستودع") +
						"</h4>",
				);
				var $warehousesTable = $(
					'<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' +
						__("المستودع") +
						"</th><th>" +
						__("عدد الفواتير") +
						"</th><th>" +
						__("المبلغ") +
						"</th></tr></thead><tbody></tbody></table>",
				);

				Object.keys(warehousesData).forEach(function (warehouse) {
					$warehousesTable
						.find("tbody")
						.append(
							"<tr><td>" +
								warehouse +
								"</td><td>" +
								warehousesData[warehouse].count +
								"</td><td>" +
								format_currency(warehousesData[warehouse].amount) +
								"</td></tr>",
						);
				});

				$analysisSection.append($warehousesTable);
			}

			$(".sales-details").append($analysisSection);
		}

		// Print button
		report.page.add_inner_button(__("طباعة سجل المبيعات المفصل"), function () {
			if (report.data && report.data.length > 0) {
				var data = report.data;
				var filters = report.get_values();

				// Show wait message while preparing the report
				frappe.show_alert({
					message: __("جاري تجهيز التقرير للطباعة..."),
					indicator: "blue",
				});

				// Create print form
				createSalesRegisterPrintForm(data, filters)
					.then(function (html) {
						var w = window.open();
						if (w) {
							w.document.write(html);
							w.document.close();
							setTimeout(function () {
								w.print();
							}, 1000);
						} else {
							frappe.msgprint(
								__(
									"تم حظر النوافذ المنبثقة. يرجى السماح بالنوافذ المنبثقة لطباعة التقرير.",
								),
							);
						}
					})
					.catch(function (error) {
						frappe.msgprint(__("حدث خطأ أثناء إعداد التقرير للطباعة: ") + error);
						console.error(error);
					});
			} else {
				frappe.msgprint(__("لا توجد بيانات لعرضها. يرجى التحقق من المرشحات."));
			}
		});

		// Export button
		report.page.add_inner_button(__("تصدير"), function () {
			if (report.data && report.data.length > 0) {
				var data = report.data;
				var filters = report.get_values();

				downloadCSV(
					data,
					"detailed_sales_log_" + filters.from_date + "_to_" + filters.to_date + ".csv",
				);
			} else {
				frappe.msgprint(__("لا توجد بيانات للتصدير"));
			}
		});
	},
};

// Function to print sales register
function createSalesRegisterPrintForm(data, filters) {
	return new Promise(function (resolve, reject) {
		try {
			// Get company information
			frappe.db.get_value(
				"Company",
				filters.company,
				["company_name", "tax_id"],
				function (companyInfo) {
					// Create sales table rows
					var salesRows = [];

					// Add sales rows
					data.forEach(function (row) {
						if (!row.is_total_row) {
							// Replace null values or "null" with empty strings
							var posting_date = row.posting_date || "";
							var posting_time = row.posting_time || "";
							var voucher_no = row.voucher_no || "";
							var voucher_type = row.voucher_type || "";
							var return_against = row.return_against || "";
							var customer_name = row.customer_name || "";
							var invoice_status = row.invoice_status || "";
							var tax_amount = row.tax_amount || 0;
							var grand_total = row.grand_total || 0;
							var pos_profile = row.pos_profile || "";
							var owner = row.owner || "";
							var warehouse = row.warehouse || "";
							var cost_center = row.cost_center || "";
							var mode_of_payment = row.mode_of_payment || "";
							var credit_return_status = row.credit_return_status || "";

							var rowClass = credit_return_status
								? 'style="background-color: #fff0f0;"'
								: "";
							var returnInfo = return_against
								? `<br><small>(مرتجع مقابل: ${return_against})</small>`
								: "";
							var creditReturnBadge = credit_return_status
								? `<br><span style="color: white; background-color: #dc3545; padding: 2px 5px; border-radius: 3px; font-size: 8px;">${credit_return_status}</span>`
								: "";

							salesRows.push(`
                            <tr ${rowClass}>
                                <td>${formatDate(posting_date)} ${formatTime(posting_time)}</td>
                                <td>${voucher_no}${returnInfo}</td>
                                <td>${voucher_type}${creditReturnBadge}</td>
                                <td>${customer_name}</td>
                                <td>${invoice_status}</td>
                                <td>${format_currency(tax_amount)}</td>
                                <td>${format_currency(grand_total)}</td>
                                <td>${pos_profile}</td>
                                <td>${owner}</td>
                                <td>${warehouse}</td>
                                <td>${cost_center}</td>
                                <td>${mode_of_payment}</td>
                            </tr>
                        `);
						}
					});

					// Add total row
					var totalRow = data.find((row) => row.is_total_row);
					if (totalRow) {
						salesRows.push(`
                        <tr style="font-weight: bold; background-color: #f2f2f2;">
                            <td colspan="5" style="text-align: center;">${__("الإجمالي")}</td>
                            <td>${format_currency(totalRow.tax_amount || 0)}</td>
                            <td>${format_currency(totalRow.grand_total || 0)}</td>
                            <td colspan="5"></td>
                        </tr>
                    `);
					}

					// Build HTML template for printing
					var currentDate = frappe.datetime.get_today();
					var currentTime = frappe.datetime.now_time();

					var html = `
                <!DOCTYPE html>
                <html dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>سجل المبيعات المفصل</title>
                    <style>
                        @page {
                            size: A4 landscape;
                            margin: 0.5cm;
                        }
                        body { 
                            font-family: Arial, sans-serif; 
                            margin: 0; 
                            padding: 0;
                            direction: rtl;
                            font-size: 11px;
                            width: 100%;
                            box-sizing: border-box;
                            page-break-after: avoid;
                        }
                        .company-info {
                            text-align: center;
                            margin-bottom: 5px;
                            padding: 5px;
                            border-bottom: 1px solid #000;
                        }
                        .company-info h3 {
                            margin: 5px 0;
                            font-size: 16px;
                        }
                        table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin-bottom: 10px; 
                            table-layout: fixed;
                        }
                        th, td { 
                            border: 1px solid #000; 
                            padding: 3px 2px; 
                            text-align: center;
                            font-size: 10px;
                            overflow: hidden;
                        }
                        th { 
                            background-color: #f2f2f2; 
                            font-weight: bold;
                            font-size: 10px;
                        }
                        .report-title {
                            text-align: center;
                            margin: 5px 0;
                            font-size: 16px;
                            font-weight: bold;
                            border-bottom: 1px solid #000;
                            padding-bottom: 5px;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 5px;
                            font-size: 10px;
                            border-top: 1px solid #000;
                            padding-top: 5px;
                        }
                        /* Enable English numbers */
                        .en-number {
                            font-family: Arial, sans-serif !important;
                            -webkit-font-feature-settings: 'tnum';
                            font-feature-settings: 'tnum';
                            font-variant-numeric: tabular-nums;
                        }
                        @media print {
                            body { 
                                margin: 0; 
                                print-color-adjust: exact;
                                -webkit-print-color-adjust: exact;
                            }
                            .avoid-break {
                                page-break-inside: avoid;
                            }
                            thead {
                                display: table-header-group;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="company-info">
                        <h3>${companyInfo.company_name}</h3>
                        <div>الرقم الضريبي: <span class="en-number">${companyInfo.tax_id || "—"}</span></div>
                    </div>
                    
                    <div class="report-title">
                        سجل المبيعات المفصل / Detailed Sales Log
                    </div>
                    
                    <table class="info-table">
                        <tr>
                            <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: left;">الفترة / Period:</td>
                            <td style="width: 35%;" class="en-number">${formatDate(filters.from_date)} ${formatTime(filters.from_time)} - ${formatDate(filters.to_date)} ${formatTime(filters.to_time)}</td>
                            <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: left;">تاريخ التقرير / Report Date:</td>
                            <td style="width: 35%;" class="en-number">${formatDate(currentDate)} ${formatTime(currentTime)}</td>
                        </tr>
                    </table>
                    
                    <table class="sales-table">
                        <thead>
                            <tr>
                                <th style="width: 9%;">التاريخ والوقت<br/>Date & Time</th>
                                <th style="width: 8%;">رقم المستند<br/>Document No</th>
                                <th style="width: 8%;">نوع المستند<br/>Type</th>
                                <th style="width: 12%;">العميل<br/>Customer</th>
                                <th style="width: 8%;">حالة الفاتورة<br/>Status</th>
                                <th style="width: 7%;">الضريبة<br/>Tax</th>
                                <th style="width: 7%;">المبلغ<br/>Amount</th>
                                <th style="width: 8%;">نقطة البيع<br/>POS</th>
                                <th style="width: 8%;">المستخدم<br/>User</th>
                                <th style="width: 8%;">المستودع<br/>Warehouse</th>
                                <th style="width: 8%;">مركز التكلفة<br/>Cost Center</th>
                                <th style="width: 9%;">طريقة الدفع<br/>Payment Method</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${salesRows.join("")}
                        </tbody>
                    </table>
                    
                    <div class="footer avoid-break">
                        تم إصدار هذا التقرير بتاريخ <span class="en-number">${formatDate(currentDate)} ${formatTime(currentTime)}</span>
                    </div>
                </body>
                </html>
                `;

					resolve(html);
				},
			);
		} catch (error) {
			reject(error);
		}
	});
}

// Date formatting function
function formatDate(dateStr) {
	if (!dateStr) return "";
	var d = new Date(dateStr);
	var day = d.getDate().toString().padStart(2, "0");
	var month = (d.getMonth() + 1).toString().padStart(2, "0");
	var year = d.getFullYear();
	return day + "/" + month + "/" + year;
}

// Time formatting function
function formatTime(timeStr) {
	if (!timeStr) return "";
	// If time is in full format like 13:45:30, we only show hours and minutes
	return timeStr.substr(0, 5); // Show only hours and minutes (HH:MM)
}

// CSV export function
function downloadCSV(data, filename) {
	var csvContent = "data:text/csv;charset=utf-8,\ufeff"; // Add BOM for Arabic support

	// Prepare headers
	var headers = [
		"التاريخ",
		"الوقت",
		"رقم المستند",
		"نوع المستند",
		"مرتجع مقابل",
		"العميل",
		"حالة الفاتورة",
		"الضريبة",
		"المبلغ",
		"نقطة البيع",
		"المستخدم",
		"المستودع",
		"مركز التكلفة",
		"طريقة الدفع",
		"حالة مرتجع الآجل",
	];
	csvContent += headers.join(",") + "\r\n";

	// Add data
	data.forEach(function (row) {
		if (!row.is_total_row) {
			var rowData = [
				row.posting_date || "",
				row.posting_time || "",
				'"' + (row.voucher_no || "") + '"',
				'"' + (row.voucher_type || "") + '"',
				'"' + (row.return_against || "") + '"',
				'"' + (row.customer_name || "") + '"',
				'"' + (row.invoice_status || "") + '"',
				row.tax_amount || 0,
				row.grand_total || 0,
				'"' + (row.pos_profile || "") + '"',
				'"' + (row.owner || "") + '"',
				'"' + (row.warehouse || "") + '"',
				'"' + (row.cost_center || "") + '"',
				'"' + (row.mode_of_payment || "") + '"',
				'"' + (row.credit_return_status || "") + '"',
			];

			// Convert numeric values to text to avoid comma issues
			rowData = rowData.map(function (val) {
				if (val === null || val === "null") return "";
				if (val === "") return val;
				return typeof val === "number" ? val.toFixed(2) : val;
			});

			csvContent += rowData.join(",") + "\r\n";
		}
	});

	// Export file
	var encodedUri = encodeURI(csvContent);
	var link = document.createElement("a");
	link.setAttribute("href", encodedUri);
	link.setAttribute("download", filename);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}
