// Copyright (c) 2026, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["Parent Accounts Trial Balance"] = {
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
			reqd: 1,
			on_change: function (query_report) {
				// When company changes, refresh the parent account filter
				var company = query_report.get_values().company;
				if (company) {
					query_report.set_filter_value("parent_account_filter", "");
					query_report.set_filter_value("cost_center", "");
					refresh_parent_account_filter(query_report, company);
				}
			},
		},
		{
			fieldname: "parent_account_filter",
			label: __("Parent Account"),
			fieldtype: "Link",
			options: "Account",
			get_query: function () {
				var company = frappe.query_report.get_filter_value("company");
				return {
					filters: [
						["Account", "is_group", "=", 1],
						["Account", "company", "=", company],
						// Removed restriction to only top-level accounts
					],
				};
			},
			on_change: function (query_report) {
				query_report.refresh();
			},
		},
		{
			fieldname: "cost_center",
			label: __("Cost Center"),
			fieldtype: "Link",
			options: "Cost Center",
			get_query: function () {
				var company = frappe.query_report.get_filter_value("company");
				return {
					filters: [["Cost Center", "company", "=", company]],
				};
			},
		},
		{
			fieldname: "fiscal_year",
			label: __("Fiscal Year"),
			fieldtype: "Link",
			options: "Fiscal Year",
			default: frappe.defaults.get_user_default("fiscal_year"),
			reqd: 1,
			on_change: function (query_report) {
				var fiscal_year = query_report.get_values().fiscal_year;
				if (!fiscal_year) {
					return;
				}
				frappe.model.with_doc("Fiscal Year", fiscal_year, function (r) {
					var fy = frappe.model.get_doc("Fiscal Year", fiscal_year);
					frappe.query_report.set_filter_value({
						from_date: fy.year_start_date,
						to_date: fy.year_end_date,
					});
				});
			},
		},
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			default: frappe.defaults.get_user_default("year_start_date"),
			reqd: 1,
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			default: frappe.defaults.get_user_default("year_end_date"),
			reqd: 1,
		},
		{
			fieldname: "with_period_closing_entry",
			label: __("With Period Closing Entry"),
			fieldtype: "Check",
			default: 1,
		},
		{
			fieldname: "show_net_values",
			label: __("Show Net Values in Opening and Closing Columns"),
			fieldtype: "Check",
			default: 0,
		},
		{
			fieldname: "presentation_currency",
			label: __("Currency"),
			fieldtype: "Select",
			options: erpnext.get_presentation_currency_list(),
		},
		{
			fieldname: "show_zero_values",
			label: __("Show Zero Values"),
			fieldtype: "Check",
		},
		{
			fieldname: "show_unclosed_fy_pl_balances",
			label: __("Show Unclosed Fiscal Year Profit / Loss Balances"),
			fieldtype: "Check",
		},
		{
			fieldname: "include_default_book_entries",
			label: __("Include Default Book Entries"),
			fieldtype: "Check",
			default: 1,
		},
	],
	onload: function (report) {
		// Ensure the report is initialized with proper default filters
		var company = frappe.defaults.get_user_default("Company");
		if (company) {
			refresh_parent_account_filter(report, company);
		}

		// Add a custom message to inform users about the report
		var message = document.createElement("div");
		message.className = "alert alert-info";
		message.innerHTML =
			"<strong>" +
			__("Note") +
			": </strong>" +
			__(
				"This report shows trial balance for accounts under the selected parent account. Select a parent account from the filter to view its trial balance."
			);

		report.page.main.find(".report-view").prepend(message);

		// Add print button
		add_print_button(report);
	},
};

// Function to refresh the parent account filter options
function refresh_parent_account_filter(report, company) {
	setTimeout(function () {
		if (!frappe.query_report) return;

		frappe.db
			.get_list("Account", {
				filters: {
					is_group: 1,
					company: company,
					// Removed filter for only top-level accounts
				},
				fields: ["name", "account_name", "account_number"],
				order_by: "account_number asc",
			})
			.then(function (accounts) {
				if (frappe.query_report) {
					frappe.query_report.refresh_filters_area();
				}
			});
	}, 100);
}

// Function to add a print button to the report
function add_print_button(report) {
	report.page.add_inner_button(__("Print Report"), function () {
		// Generate a report header for printing
		var reportHeader = $(`
            <div class="print-format-information" style="display:none;">
                <h2 style="text-align: center; margin-bottom: 10px;">
                    ${__("Parent Accounts Trial Balance")}
                </h2>
                <div style="text-align: center; margin-bottom: 10px;">
                    <strong>${__("Company")}:</strong> ${frappe.query_report.get_filter_value(
			"company"
		)}
                </div>
                <div style="text-align: center; display: flex; justify-content: center; margin-bottom: 15px;">
                    <div style="margin-right: 30px;">
                        <strong>${__("From Date")}:</strong> 
                        ${frappe.format(frappe.query_report.get_filter_value("from_date"), {
							fieldtype: "Date",
						})}
                    </div>
                    <div>
                        <strong>${__("To Date")}:</strong> 
                        ${frappe.format(frappe.query_report.get_filter_value("to_date"), {
							fieldtype: "Date",
						})}
                    </div>
                </div>
                <div style="text-align: center; margin-bottom: 10px;">
                    <strong>${__("Parent Account")}:</strong> 
                    ${
						frappe.query_report.get_filter_value("parent_account_filter") ||
						__("All Accounts")
					}
                </div>
            </div>
        `);

		// Append the header to the report container
		frappe.query_report.wrapper.find(".report-container").prepend(reportHeader);

		// Show the header (it's hidden by default for screen view)
		reportHeader.show();

		// Print the report
		window.print();

		// Remove the header after printing
		setTimeout(function () {
			reportHeader.remove();
		}, 1000);
	});
}
