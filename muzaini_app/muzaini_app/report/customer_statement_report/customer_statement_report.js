// Copyright (c) 2026, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["Customer Statement Report"] = {
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
			reqd: 1,
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
			default: frappe.datetime.add_months(frappe.datetime.get_today(), -3),
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
			fieldname: "users",
			label: __("المستخدمين"),
			fieldtype: "MultiSelectList",
			width: "200px",
			get_data: function (txt) {
				return frappe.db.get_link_options("User", txt);
			},
		},
		{
			fieldname: "cost_centers",
			label: __("مراكز التكلفة"),
			fieldtype: "MultiSelectList",
			width: "200px",
			get_data: function (txt) {
				return frappe.db.get_link_options("Cost Center", txt, {
					company: frappe.query_report.get_filter_value("company"),
				});
			},
			depends_on: "company",
		},
		{
			fieldname: "warehouses",
			label: __("المستودعات"),
			fieldtype: "MultiSelectList",
			width: "200px",
			get_data: function (txt) {
				return frappe.db.get_link_options("Warehouse", txt, {
					company: frappe.query_report.get_filter_value("company"),
				});
			},
			depends_on: "company",
		},
	],
	formatter: function (value, row, column, data, default_formatter) {
		if (data) {
			if (value === null || value === undefined) {
				value = "";
			}

			if (column.fieldname === "voucher_type") {
				switch (value) {
					case "Sales Invoice":
						return "فاتورة مبيعات";
					case "Payment Entry":
						let paymentType = "";
						if (data.payment_type === "استلام") {
							paymentType =
								'<span style="color: green; font-weight: bold;">&#128176; سند استلام</span>';
						} else if (data.payment_type === "دفع") {
							paymentType =
								'<span style="color: red; font-weight: bold;">&#128184; سند دفع</span>';
						} else {
							paymentType = "سند قبض";
						}
						return paymentType;
					case "Journal Entry":
						return "قيد محاسبي";
					case "Purchase Invoice":
						return "فاتورة مشتريات";
					case "Total":
						return "الإجمالي";
					case "Opening Balance":
						return "رصيد افتتاحي";
					default:
						return value || "";
				}
			}

			if (column.fieldname === "invoice_status") {
				if (!value) return "";

				let color = "black";
				if (value.includes("مرتجع")) {
					color = "red";
				} else if (
					value.includes("نقدية") ||
					value.includes("مسددة بالكامل") ||
					value === "سداد"
				) {
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

			if (column.fieldname === "payment_type") {
				if (!value) return "";

				let color = "black";
				let icon = "";

				if (value === "استلام") {
					color = "green";
					icon = "&#128176;";
				} else if (value === "دفع") {
					color = "red";
					icon = "&#128184;";
				}

				return `<span style="color: ${color}; font-weight: bold;">${icon} ${value}</span>`;
			}

			if (column.fieldname === "balance") {
				// Consistent logic: negative balance = دائن, positive balance = مدين
				return (
					'<span style="color: ' +
					(value < 0 ? "red" : "blue") +
					';">' +
					default_formatter(Math.abs(value), row, column, data) +
					" " +
					(value < 0 ? "دائن" : "مدين") +
					"</span>"
				);
			}

			if (data.is_opening_row) {
				return (
					'<span style="font-weight: bold; color: #4272d7;">' +
					default_formatter(value, row, column, data) +
					"</span>"
				);
			}

			if (data.is_total_row) {
				return (
					'<span style="font-weight: bold;">' +
					default_formatter(value, row, column, data) +
					"</span>"
				);
			}
		}

		return default_formatter(value, row, column, data);
	},

	onload: function (report) {
		console.log("تم تحميل تقرير كشف حساب العميل");

		$(
			'<style>\
            .datatable .dt-cell { padding: 0px 0px !important; }\
            .datatable .dt-row { border-bottom: 1px solid #eee; }\
            .datatable .dt-header .dt-cell { background-color: #f5f7fa; font-weight: bold; }\
            .customer-summary-section { direction: rtl; }\
            .balance-card { background-color: #f8f8f8; border-radius: 5px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }\
            .balance-card-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; }\
            .balance-amount { font-size: 20px; font-weight: bold; }\
            .balance-card.debit { border-right: 5px solid #4272d7; }\
            .balance-card.credit { border-right: 5px solid #28a745; }\
            .balance-card.closing { border-right: 5px solid #fd7e14; }\
            .debit-amount { color: #4272d7; }\
            .credit-amount { color: #28a745; }\
            .closing-amount { color: #fd7e14; }\
            .opening-balance-container { \
                background-color: #f0f7ff; \
                border: 2px solid #4272d7; \
                border-radius: 5px; \
                padding: 15px; \
                margin-bottom: 20px; \
                margin-top: 10px; \
            }\
            .opening-balance-title { \
                font-size: 18px; \
                font-weight: bold; \
                color: #2c5282; \
                margin-bottom: 10px; \
                text-align: center; \
                border-bottom: 1px solid #b3c9e8; \
                padding-bottom: 8px; \
            }\
            .opening-balance-details { \
                display: flex; \
                justify-content: space-between; \
                align-items: center; \
            }\
            .opening-balance-label { \
                font-size: 15px; \
                font-weight: bold; \
            }\
            .opening-balance-value { \
                font-size: 18px; \
                font-weight: bold; \
                padding: 5px 15px; \
                border-radius: 4px; \
                background-color: #ffffff; \
                box-shadow: 0 1px 3px rgba(0,0,0,0.1); \
            }\
            .opening-balance-row td { \
                background-color: #f0f7ff !important; \
            }\
            .frappe-control[data-fieldname="users"] ul.choices__list,\
            .frappe-control[data-fieldname="cost_centers"] ul.choices__list,\
            .frappe-control[data-fieldname="warehouses"] ul.choices__list {\
                max-height: 120px;\
                overflow-y: auto;\
            }\
            .filter-badges {\
                margin-top: 10px;\
                margin-bottom: 10px;\
                padding: 5px;\
                background-color: #f8f8f8;\
                border-radius: 5px;\
            }\
            .filter-badge {\
                display: inline-block;\
                margin: 3px;\
                padding: 3px 8px;\
                background-color: #e2e8f0;\
                border-radius: 12px;\
                font-size: 11px;\
            }\
            .payment-type-receipt {\
                color: green;\
                font-weight: bold;\
            }\
            .payment-type-payment {\
                color: red;\
                font-weight: bold;\
            }\
        </style>',
		).appendTo("head");

		var $customerSummarySection = $(
			'<div class="customer-summary-section" style="margin-bottom: 20px;"></div>',
		);
		$customerSummarySection.html(`<div style="margin-bottom: 10px; padding: 10px;"></div>`);

		var $openingBalanceContainer = $('<div class="opening-balance-container"></div>');

		var $filterBadgesSection = $('<div class="filter-badges"></div>');

		var $balanceCardsSection = $(
			'<div class="balance-cards" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;"></div>',
		);
		var $debitCard = $(
			'<div class="balance-card debit" style="flex: 1;"><div class="balance-card-title">' +
				__("إجمالي المدين") +
				'</div><div class="balance-amount debit-amount"></div></div>',
		);
		var $creditCard = $(
			'<div class="balance-card credit" style="flex: 1;"><div class="balance-card-title">' +
				__("إجمالي الدائن") +
				'</div><div class="balance-amount credit-amount"></div></div>',
		);
		var $closingBalanceCard = $(
			'<div class="balance-card closing" style="flex: 1;"><div class="balance-card-title">' +
				__("الرصيد الختامي") +
				'</div><div class="balance-amount closing-amount"></div></div>',
		);

		$balanceCardsSection.append($debitCard).append($creditCard).append($closingBalanceCard);

		var $customerInfoSection = $(
			'<div class="customer-info" style="margin-top: 20px; margin-bottom: 20px;"></div>',
		);

		var $transactionsSummary = $(
			'<div class="transactions-summary" style="margin-top: 20px;"></div>',
		);

		report.page.main.find(".report-filter-section").after($customerSummarySection);

		report.page.main.find(".report-filter-section").after($filterBadgesSection);

		report.page.main.find(".datatable-wrapper").before($openingBalanceContainer);

		$customerSummarySection
			.append($customerInfoSection)
			.append($balanceCardsSection)
			.append($transactionsSummary);

		function updateSelectedFilters() {
			var filters = report.get_values();
			var filtersHTML = "";

			if (filters.users && filters.users.length) {
				filtersHTML +=
					'<div style="margin-bottom: 5px;"><strong>' + __("المستخدمين: ") + "</strong>";
				filters.users.forEach(function (user) {
					filtersHTML += '<span class="filter-badge">' + user + "</span>";
				});
				filtersHTML += "</div>";
			}

			if (filters.cost_centers && filters.cost_centers.length) {
				filtersHTML +=
					'<div style="margin-bottom: 5px;"><strong>' +
					__("مراكز التكلفة: ") +
					"</strong>";
				filters.cost_centers.forEach(function (cc) {
					filtersHTML += '<span class="filter-badge">' + cc + "</span>";
				});
				filtersHTML += "</div>";
			}

			if (filters.warehouses && filters.warehouses.length) {
				filtersHTML +=
					'<div style="margin-bottom: 5px;"><strong>' + __("المستودعات: ") + "</strong>";
				filters.warehouses.forEach(function (wh) {
					filtersHTML += '<span class="filter-badge">' + wh + "</span>";
				});
				filtersHTML += "</div>";
			}

			if (filtersHTML) {
				$filterBadgesSection.html(filtersHTML).show();
			} else {
				$filterBadgesSection.hide();
			}
		}

		var originalRefresh = report.refresh;
		report.refresh = function () {
			originalRefresh.call(this);

			updateSelectedFilters();

			if (report.data && report.data.length > 0) {
				hideOpeningBalanceRow(report);

				updateOpeningBalanceContainer(report);

				updateCustomerSummary(report);
			} else {
				$(".opening-balance-container").empty();
				$(".customer-info").empty();
				$(".debit-amount").text("0.00");
				$(".credit-amount").text("0.00");
				$(".closing-amount").text("0.00");
				$(".transactions-summary").empty();
			}
		};

		function hideOpeningBalanceRow(report) {
			if (!report.datatable) return;

			var rowIndex = -1;

			for (var i = 0; i < report.data.length; i++) {
				if (report.data[i].voucher_type === "Opening Balance") {
					rowIndex = i;
					break;
				}
			}

			if (rowIndex >= 0) {
				report.datatable.style.setCellStyle(rowIndex, null, {
					backgroundColor: "#f0f7ff",
					fontWeight: "bold",
					borderBottom: "2px solid #4272d7",
				});
			}
		}

		function updateOpeningBalanceContainer(report) {
			var report_dict = report.report_dict || {};
			var openingBalance = report_dict.opening_balance || 0;
			var openingDate = report_dict.opening_date || null;

			if (!openingDate) {
				try {
					for (var i = 0; i < report.data.length; i++) {
						if (report.data[i].voucher_type === "Opening Balance") {
							openingBalance = report.data[i].balance;
							openingDate = frappe.datetime.str_to_user(report.data[i].posting_date);
							break;
						}
					}
				} catch (e) {
					console.error("Error finding opening balance from data:", e);
				}
			}

			$(".opening-balance-container").empty();
			$(".opening-balance-container").html(`
                <div class="opening-balance-title">رصيد سابق</div>
                <div class="opening-balance-details">
                    <div class="opening-balance-label">الرصيد السابق حتى تاريخ ${openingDate || ""}:</div>
                    <div class="opening-balance-value" style="color: ${openingBalance >= 0 ? "#4272d7" : "#e53e3e"}">
                        ${format_currency(Math.abs(openingBalance))} ${openingBalance >= 0 ? __("مدين") : __("دائن")}
                    </div>
                </div>
            `);
		}

		function updateCustomerSummary(report) {
			if (!report.data || report.data.length === 0) return;

			var filters = report.get_values();

			var totalDebit = 0;
			var totalCredit = 0;

			for (var i = 0; i < report.data.length; i++) {
				var row = report.data[i];
				if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
					totalDebit += flt(row.debit);
					totalCredit += flt(row.credit);
				}
			}

			var lastRow = report.data[report.data.length - 1];
			var closingBalance = lastRow ? lastRow.balance : 0;

			$(".debit-amount").text(format_currency(totalDebit));
			$(".credit-amount").text(format_currency(totalCredit));
			$(".closing-amount").text(
				format_currency(Math.abs(closingBalance)) +
					" " +
					(closingBalance < 0 ? __("دائن") : __("مدين")),
			);

			updateCustomerInfo(filters);

			updateTransactionSummary(report.data);
		}

		function updateCustomerInfo(filters) {
			if (!filters || !filters.customer) return;

			frappe.db.get_value(
				"Customer",
				filters.customer,
				[
					"customer_name",
					"customer_group",
					"territory",
					"tax_id",
					"customer_type",
					"payment_terms",
				],
				function (r) {
					if (r) {
						frappe.call({
							method: "erpnext.accounts.utils.get_balance_on",
							args: {
								party_type: "Customer",
								party: filters.customer,
								company: filters.company,
							},
							callback: function (response) {
								var systemBalance = response.message || 0;

								$(".customer-info").empty();
								$(".customer-info").append(`
                                    <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                                        <div style="flex: 1 0 300px; background-color: #f8f8f8; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                                            <table style="width: 100%;">
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("كود العميل")}</td>
                                                    <td style="padding: 5px 0; font-weight: bold;">${filters.customer}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("اسم العميل")}</td>
                                                    <td style="padding: 5px 0;">${r.customer_name || filters.customer}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("مجموعة العميل")}</td>
                                                    <td style="padding: 5px 0;">${r.customer_group || ""}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("الرقم الضريبي")}</td>
                                                    <td style="padding: 5px 0;">${r.tax_id || ""}</td>
                                                </tr>
                                            </table>
                                        </div>
                                        <div style="flex: 1 0 300px; background-color: #f8f8f8; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                                            <table style="width: 100%;">
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("نوع العميل")}</td>
                                                    <td style="padding: 5px 0;">${r.customer_type || ""}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("شروط الدفع")}</td>
                                                    <td style="padding: 5px 0;">${r.payment_terms || ""}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("الفترة")}</td>
                                                    <td style="padding: 5px 0;">${frappe.datetime.str_to_user(filters.from_date)} - ${frappe.datetime.str_to_user(filters.to_date)}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("رصيد النظام")}</td>
                                                    <td style="padding: 5px 0; font-weight: bold; color: " + (systemBalance >= 0 ? "blue" : "red") + ";">${format_currency(Math.abs(systemBalance))} ${systemBalance >= 0 ? "مدين" : "دائن"}</td>
                                                </tr>
                                            </table>
                                        </div>
                                    </div>
                                `);
							},
						});
					}
				},
			);
		}

		function updateTransactionSummary(data) {
			var invoiceCount = 0;
			var paymentCount = 0;
			var returnCount = 0;
			var otherCount = 0;
			var receiptCount = 0;
			var paymentVoucherCount = 0;

			data.forEach(function (row) {
				if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
					if (row.voucher_type === "Sales Invoice") {
						if (row.invoice_status && row.invoice_status.includes("مرتجع")) {
							returnCount++;
						} else {
							invoiceCount++;
						}
					} else if (row.voucher_type === "Payment Entry") {
						paymentCount++;

						if (row.payment_type === "استلام") {
							receiptCount++;
						} else if (row.payment_type === "دفع") {
							paymentVoucherCount++;
						}
					} else {
						otherCount++;
					}
				}
			});

			$(".transactions-summary").empty();
			$(".transactions-summary").append(`
                <div style="margin-top: 20px;">
                    <h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">${__("ملخص المعاملات")}</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        <div style="flex: 1 0 150px; background-color: #eaf4ff; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #4272d7;">${invoiceCount}</div>
                            <div style="color: #666;">${__("فواتير مبيعات")}</div>
                        </div>
                        <div style="flex: 1 0 150px; background-color: #e8f5e9; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #28a745;">${receiptCount}</div>
                            <div style="color: #666;">${__("سندات استلام")}</div>
                        </div>
                        <div style="flex: 1 0 150px; background-color: #ffebee; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${paymentVoucherCount}</div>
                            <div style="color: #666;">${__("سندات دفع")}</div>
                        </div>
                        <div style="flex: 1 0 150px; background-color: #fff3e0; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #fd7e14;">${returnCount}</div>
                            <div style="color: #666;">${__("مرتجعات")}</div>
                        </div>
                        <div style="flex: 1 0 150px; background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #6c757d;">${otherCount}</div>
                            <div style="color: #666;">${__("معاملات أخرى")}</div>
                        </div>
                    </div>
                </div>
            `);
		}

		report.page.add_inner_button(__("طباعة كشف الحساب"), function () {
			if (report.data && report.data.length > 0) {
				var data = report.data;
				var filters = report.get_values();
				var report_dict = report.report_dict || {};

				frappe.show_alert({
					message: __("جاري تجهيز التقرير للطباعة..."),
					indicator: "blue",
				});

				createCustomerStatementForm(data, filters, report_dict)
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

		report.page.add_inner_button(__("تصدير"), function () {
			if (report.data && report.data.length > 0) {
				var data = report.data;
				var filters = report.get_values();

				downloadCSV(
					data,
					"customer_statement_" +
						filters.customer +
						"_" +
						filters.from_date +
						"_to_" +
						filters.to_date +
						".csv",
				);
			} else {
				frappe.msgprint(__("لا توجد بيانات للتصدير"));
			}
		});
	},

	initial_setup: true,
	show_filters_on_top: true,
};

function createCustomerStatementForm(data, filters, report_dict) {
	return new Promise(function (resolve, reject) {
		try {
			frappe.db.get_value(
				"Company",
				filters.company,
				["company_name", "tax_id", "company_logo"],
				function (companyInfo) {
					frappe.db.get_value(
						"Customer",
						filters.customer,
						["customer_name", "tax_id"],
						function (customerInfo) {
							var openingBalance = 0;
							var openingDate = null;

							if (report_dict && report_dict.opening_balance !== undefined) {
								openingBalance = report_dict.opening_balance;
								openingDate = report_dict.opening_date;
							} else {
								for (var i = 0; i < data.length; i++) {
									if (data[i].voucher_type === "Opening Balance") {
										openingBalance = data[i].balance;
										openingDate = frappe.datetime.str_to_user(
											data[i].posting_date,
										);
										break;
									}
								}
							}

							var totalDebit = 0;
							var totalCredit = 0;

							for (var i = 0; i < data.length; i++) {
								var row = data[i];
								if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
									totalDebit += flt(row.debit);
									totalCredit += flt(row.credit);
								}
							}

							var closingBalance = openingBalance + totalDebit - totalCredit;

							var transactionRows = [];

							for (var i = 0; i < data.length; i++) {
								var row = data[i];
								if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
									var documentType = "";

									if (row.voucher_type === "Sales Invoice") {
										if (
											row.invoice_status &&
											row.invoice_status.includes("مرتجع")
										) {
											documentType = "مرتجع مبيعات";
										} else {
											documentType = "فاتورة مبيعات";
										}
									} else if (row.voucher_type === "Payment Entry") {
										documentType = "سند " + (row.payment_type || "قبض");
									} else if (row.voucher_type === "Journal Entry") {
										documentType = "قيد محاسبي";
									} else {
										documentType = row.voucher_type || "";
									}

									transactionRows.push(`
                                <tr>
                                    <td>${frappe.datetime.str_to_user(row.posting_date)}</td>
                                    <td>${row.voucher_no || ""}</td>
                                    <td>${documentType}</td>
                                    <td>${row.description || "لايوجد ملاحظات"}</td>
                                    <td>${row.invoice_status || ""}</td>
                                    <td>${row.debit > 0 ? format_currency(row.debit) : ""}</td>
                                    <td>${row.credit > 0 ? format_currency(row.credit) : ""}</td>
                                    <td class="balance-cell">${format_currency(Math.abs(row.balance))} ${row.balance < 0 ? "دائن" : "مدين"}</td>
                                </tr>
                            `);
								}
							}

							var currentDate = frappe.datetime.get_today();
							var currentTime = frappe.datetime.now_time().substr(0, 5);

							var headerStyles = `
                        .company-header {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            padding: 10px 0;
                            margin-bottom: 10px;
                            border-bottom: 1px solid #000;
                        }
                        .company-logo {
                            text-align: center;
                        }
                        .company-logo img {
                            max-height: 80px;
                            max-width: 150px;
                        }
                        .tax-id {
                            text-align: center;
                            margin-top: 5px;
                            font-size: 12px;
                        }
                    `;

							var companyHeaderHTML = `
                    <div class="company-header">
                        <div class="company-logo" style="flex: 1; text-align: center;">
                            ${
								companyInfo.company_logo
									? `<img src="${companyInfo.company_logo}" alt="Company Logo">`
									: `<div style="height: 60px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px;">${companyInfo.company_name}</div>`
							}
                            <div class="tax-id">الرقم الضريبي: <span class="en-number">${companyInfo.tax_id || "—"}</span></div>
                        </div>
                    </div>
                    `;

							var filtersInfoHTML = "";
							if (filters.users && filters.users.length) {
								filtersInfoHTML +=
									'<tr><td style="background-color: #f2f2f2; font-weight: bold; text-align: right;">' +
									__("المستخدمين") +
									':</td><td colspan="3">' +
									filters.users.join(", ") +
									"</td></tr>";
							}
							if (filters.cost_centers && filters.cost_centers.length) {
								filtersInfoHTML +=
									'<tr><td style="background-color: #f2f2f2; font-weight: bold; text-align: right;">' +
									__("مراكز التكلفة") +
									':</td><td colspan="3">' +
									filters.cost_centers.join(", ") +
									"</td></tr>";
							}
							if (filters.warehouses && filters.warehouses.length) {
								filtersInfoHTML +=
									'<tr><td style="background-color: #f2f2f2; font-weight: bold; text-align: right;">' +
									__("المستودعات") +
									':</td><td colspan="3">' +
									filters.warehouses.join(", ") +
									"</td></tr>";
							}

							var html = `
                    <!DOCTYPE html>
                    <html dir="rtl">
                    <head>
                        <meta charset="UTF-8">
                        <title>كشف حساب العميل - ${customerInfo.customer_name || filters.customer}</title>
                        <style>
                            @page {
                                size: A4;
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
                            ${headerStyles}
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
                            .balance-cell {
                                white-space: nowrap;
                                text-align: center;
                                font-size: 10px;
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
                            .opening-balance-info {
                                background-color: #f0f7ff;
                                border: 2px solid #4272d7;
                                border-radius: 5px;
                                padding: 10px;
                                margin: 10px 0 20px;
                                font-weight: bold;
                            }
                            .opening-balance-title {
                                font-size: 14px;
                                font-weight: bold;
                                color: #2c5282;
                                margin-bottom: 8px;
                                text-align: center;
                                border-bottom: 1px solid #b3c9e8;
                                padding-bottom: 5px;
                            }
                            .totals {
                                display: flex;
                                justify-content: space-between;
                                margin: 10px 0;
                                border-top: 1px solid #000;
                                padding-top: 5px;
                            }
                            .total-box {
                                width: 33%;
                                text-align: center;
                                padding: 5px;
                                border: 1px solid #000;
                                background-color: #f2f2f2;
                            }
                            .footer {
                                text-align: center;
                                margin-top: 5px;
                                font-size: 10px;
                                border-top: 1px solid #000;
                                padding-top: 5px;
                            }
                            .signatures {
                                display: flex;
                                justify-content: space-between;
                                margin-top: 10px;
                            }
                            .signature-box {
                                width: 32%;
                                text-align: center;
                            }
                            .signature-line {
                                border-bottom: 1px solid #000;
                                height: 30px;
                                margin-bottom: 5px;
                            }
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
                        ${companyHeaderHTML}
                        
                        <div class="report-title">
                            كشف حساب العميل / Customer Statement
                        </div>
                        
                        <table class="info-table">
                            <tr>
                                <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: right;">عميل / Customer:</td>
                                <td style="width: 35%;">${customerInfo.customer_name || filters.customer}</td>
                                <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: right;">الفترة / Period:</td>
                                <td style="width: 35%;" class="en-number">${frappe.datetime.str_to_user(filters.from_date)} - ${frappe.datetime.str_to_user(filters.to_date)}</td>
                            </tr>
                            <tr>
                                <td style="background-color: #f2f2f2; font-weight: bold; text-align: right;">الرقم الضريبي / Tax ID:</td>
                                <td class="en-number">${customerInfo.tax_id || "—"}</td>
                                <td style="background-color: #f2f2f2; font-weight: bold; text-align: right;">تاريخ التقرير / Report Date:</td>
                                <td class="en-number">${frappe.datetime.str_to_user(currentDate)} ${currentTime}</td>
                            </tr>
                            ${filtersInfoHTML}
                        </table>
                        
                        <div class="opening-balance-info">
                            <div class="opening-balance-title">رصيد سابق - Previous Balance</div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>الرصيد السابق حتى تاريخ ${openingDate || ""}:</div>
                                <div style="color: ${openingBalance < 0 ? "#e53e3e" : "#4272d7"}; background-color: #fff; padding: 5px 15px; border-radius: 4px; font-size: 14px; border: 1px solid #ddd;">
                                    ${format_currency(Math.abs(openingBalance))} ${openingBalance < 0 ? "دائن / Credit" : "مدين / Debit"}
                                </div>
                            </div>
                        </div>
                        
                        <table class="transactions-table">
                            <thead>
                                <tr>
                                    <th style="width: 10%;">التاريخ<br/>Date</th>
                                    <th style="width: 12%;">رقم المستند<br/>Document No</th>
                                    <th style="width: 12%;">نوع المستند<br/>Type</th>
                                    <th style="width: 20%;">البيان<br/>Description</th>
                                    <th style="width: 10%;">حالة المستند<br/>Status</th>
                                    <th style="width: 10%;">مدين<br/>Debit</th>
                                    <th style="width: 10%;">دائن<br/>Credit</th>
                                    <th style="width: 14%;">الرصيد<br/>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${transactionRows.join("")}
                            </tbody>
                        </table>
                        
                                                    <div class="totals avoid-break">
                            <div class="total-box">
                                <div style="font-weight: bold; margin-bottom: 5px;">إجمالي المدين / Debit Total:</div>
                                <div class="en-number">${format_currency(totalDebit)}</div>
                            </div>
                            <div class="total-box">
                                <div style="font-weight: bold; margin-bottom: 5px;">إجمالي الدائن / Credit Total:</div>
                                <div class="en-number">${format_currency(totalCredit)}</div>
                            </div>
                            <div class="total-box">
                                <div style="font-weight: bold; margin-bottom: 5px;">الرصيد الختامي / Closing Balance:</div>
                                <div class="en-number">${format_currency(Math.abs(closingBalance))} ${closingBalance < 0 ? "دائن / Credit" : "مدين / Debit"}</div>
                            </div>
                        </div>
                        
                        <div class="signatures avoid-break">
                            <div class="signature-box">
                                <div class="signature-line"></div>
                                <div>توقيع العميل / Customer Signature</div>
                            </div>
                            <div class="signature-box">
                                <div class="signature-line"></div>
                                <div>المحاسب / Accountant</div>
                            </div>
                            <div class="signature-box">
                                <div class="signature-line"></div>
                                <div>المدير المالي / Financial Manager</div>
                            </div>
                        </div>
                        
                        <div class="footer avoid-break">
                            تم إصدار هذا الكشف بتاريخ <span class="en-number">${frappe.datetime.str_to_user(currentDate)} ${currentTime}</span>
                        </div>
                    </body>
                    </html>
                    `;

							resolve(html);
						},
					);
				},
			);
		} catch (error) {
			reject(error);
		}
	});
}

function downloadCSV(data, filename) {
	var csvContent = "data:text/csv;charset=utf-8,\ufeff";

	var headers = [
		"التاريخ",
		"رقم المستند",
		"نوع المستند",
		"البيان",
		"حالة المستند",
		"نوع السند",
		"مدين",
		"دائن",
		"الرصيد",
	];
	csvContent += headers.join(",") + "\r\n";

	data.forEach(function (row) {
		if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
			var rowData = [
				frappe.datetime.str_to_user(row.posting_date) || "",
				'"' + (row.voucher_no || "") + '"',
				'"' + (row.voucher_type || "") + '"',
				'"' + (row.description || "لايوجد ملاحظات") + '"',
				'"' + (row.invoice_status || "") + '"',
				'"' + (row.payment_type || "") + '"',
				row.debit || 0,
				row.credit || 0,
				row.balance || 0,
			];

			rowData = rowData.map(function (val) {
				if (val === "") return val;
				return typeof val === "number" ? val.toFixed(2) : val;
			});

			csvContent += rowData.join(",") + "\r\n";
		}
	});

	var encodedUri = encodeURI(csvContent);
	var link = document.createElement("a");
	link.setAttribute("href", encodedUri);
	link.setAttribute("download", filename);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}
