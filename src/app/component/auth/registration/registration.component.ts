import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators, FormArray } from "@angular/forms";
import { Router } from "@angular/router";
import { NotificationService } from "src/app/util/service/notification.service";
import { ValidationService } from "src/app/util/service/validation.service";
import { UserService } from "src/app/util/service/db/user.service";
import { User, CURRENCIES, DEFAULT_CURRENCY, Category } from "src/app/util/models";
import { AppState } from "src/app/store/app.state";
import { Store } from "@ngrx/store";
import { createAccount } from "src/app/store/accounts/accounts.actions";
import { createCategory } from "src/app/store/categories/categories.actions";
import { AccountType } from "src/app/util/config/enums";
import { APP_CONFIG, defaultCategoriesForNewUser } from "src/app/util/config/config";

interface BankAccount {
	id?: string;
	name: string;
	type: "checking" | "savings" | "credit" | "investment";
	balance: number;
	currency: string;
	institution: string;
	accountNumber?: string;
}


export const defaultBankAccounts: BankAccount[] = [
	{ name: "Savings Account", type: "savings", balance: 0, currency: DEFAULT_CURRENCY, institution: 'Bank' },
	//add accountId, userId, createdAt 
];

@Component({
	selector: "app-registration",
	templateUrl: "./registration.component.html",
	styleUrls: ["./registration.component.scss"],
})
export class RegistrationComponent implements OnInit {
	registrationForm: FormGroup;
	isLoading = false;
	currentStep = 1;
	totalSteps = 4;
	currentUser: any;

	// Predefined categories for new users


	// Predefined bank account types


	currencies = CURRENCIES;

	constructor(
		private fb: FormBuilder,
		private router: Router,
		private userService: UserService,
		private notificationService: NotificationService,
		private validationService: ValidationService,
		private store: Store<AppState>

	) {
		this.registrationForm = this.fb.group({
			// Step 1: Basic Profile
			profile: this.fb.group(
				{
					firstName: ["", this.validationService.getAuthNameValidators()],
					lastName: ["", this.validationService.getAuthNameValidators()],
					email: ["", this.validationService.getProfileEmailValidators()],
					phone: ["", this.validationService.getProfilePhoneValidators()],
					dateOfBirth: [""],
					occupation: [""],
					monthlyIncome: [0, this.validationService.getProfileIncomeValidators()],
				},
			),

			// Step 2: Bank Accounts
			bankAccounts: this.fb.array([]),

			// Step 3: Categories
			categories: this.fb.array([]),

			// Step 4: Preferences
			preferences: this.fb.group({
				defaultCurrency: [DEFAULT_CURRENCY, Validators.required],
				timezone: ["UTC", Validators.required],
				language: ["en", Validators.required],
				notifications: [true],
				emailUpdates: [true],
				budgetAlerts: [true],
			}),
		});
	}

	ngOnInit() {
		this.initializeDefaultData();
	}

	private initializeDefaultData() {
		//get from googgle token
		this.currentUser = this.userService.userAuth$.value;
		if (this.currentUser) {
			this.registrationForm.get("profile.email")?.setValue(this.currentUser?.email);
			this.registrationForm.get("profile.firstName")?.setValue(this.currentUser?.displayName);
			this.registrationForm.get("profile.email")?.disable();
			// Add a default bank account
			this.addBankAccount();

			// Add default categories
			defaultCategoriesForNewUser.forEach((category: Category) => {
				this.addCategory(category);
			});
		} else {
			this.router.navigate(["/sign-in"]);
		}
	}

	// Form Array Getters
	get bankAccountsArray() {
		return this.registrationForm.get("bankAccounts") as FormArray;
	}

	get categoriesArray() {
		return this.registrationForm.get("categories") as FormArray;
	}


	// Bank Account Methods
	addBankAccount(account?: BankAccount) {
		const bankAccountForm = this.fb.group({
			name: [account?.name || "", this.validationService.getAccountNameValidators()],
			type: [account?.type || "checking", Validators.required],
			balance: [account?.balance || 0, this.validationService.getAccountBalanceValidators()],
			currency: [account?.currency || DEFAULT_CURRENCY, Validators.required],
		});

		this.bankAccountsArray.push(bankAccountForm);
	}

	removeBankAccount(index: number) {
		if (this.bankAccountsArray.length > 1) {
			this.bankAccountsArray.removeAt(index);
		}
	}

	// Category Methods
	addCategory(category?: Category) {
		const categoryForm = this.fb.group({
			name: [category?.name || "", this.validationService.getCategoryNameValidators()],
			type: [category?.type || "expense", Validators.required],
			color: [category?.color || "#46777f", Validators.required],
			icon: [category?.icon || "category", Validators.required],
		});

		this.categoriesArray.push(categoryForm);
	}

	removeCategory(index: number) {
		if (this.categoriesArray.length > 1) {
			this.categoriesArray.removeAt(index);
		}
	}

	// Navigation Methods
	nextStep() {
		if (this.currentStep < this.totalSteps) {
			this.currentStep++;
		}
	}

	previousStep() {
		if (this.currentStep > 1) {
			this.currentStep--;
		}
	}

	// Step Validation
	isStepValid(step: number): boolean {
		switch (step) {
			case 1:
				return this.registrationForm.get("profile")?.valid || false;
			case 2:
				return this.bankAccountsArray.valid && this.bankAccountsArray.length > 0;
			case 3:
				return this.categoriesArray.valid && this.categoriesArray.length > 0;
			case 4:
				return this.registrationForm.get("preferences")?.valid || false;
			default:
				return false;
		}
	}

	// Registration
	async onRegister() {
		if (this.registrationForm.valid) {
			this.isLoading = true;

			try {
				const formValue = this.registrationForm.value;

				// 1. get user account
				const user: any = this.currentUser;

				// 2. Create user profile in Firestore
				const userProfile = {
					uid: user?.uid,
					firstName: formValue.profile.firstName,
					lastName: formValue.profile.lastName,
					phone: formValue.profile.phone,
					dateOfBirth: formValue.profile.dateOfBirth,
					occupation: formValue.profile.occupation,
					monthlyIncome: formValue.profile.monthlyIncome,
					preferences: formValue.preferences,
					createdAt: new Date(),
				};

				await this.userService.createOrUpdateUser((userProfile as unknown) as User);

				// 3. Create bank accounts
				for (const account of formValue.bankAccounts) {
					await this.store.dispatch(createAccount({
						userId: user?.uid,
						accountData: {
							name: account.name,
							type: this.mapBankAccountType(account.type),
							balance: account.balance,
							description: `${account.type} account`,
							institution: account.institution,
							currency: account.currency,
							accountNumber: account.accountNumber
						}
					}));
				}

				// 4. Create categories
				for (const category of formValue.categories) {
					await this.store.dispatch(
						createCategory({
							userId: user?.uid,
							name: category.name,
							categoryType: category.type,
							icon: category.icon,
							color: category.color,
						})
					);
				}

				this.notificationService.success(`Registration successful! Welcome to ${APP_CONFIG.APP_NAME}.`);
				this.router.navigate(["/dashboard"]);
			} catch (error: any) {
				console.error("Registration error:", error);
				this.notificationService.error(error.message || "Registration failed. Please try again.");
			} finally {
				this.isLoading = false;
			}
		} else {
			this.notificationService.error("Please fill all required fields correctly.");
		}
	}

	// Utility Methods
	getStepProgress(): number {
		return (this.currentStep / this.totalSteps) * 100;
	}

	getStepTitle(step: number): string {
		const titles = {
			1: "Profile Information",
			2: "Bank Accounts",
			3: "Categories",
			4: "Preferences",
		};
		return titles[step as keyof typeof titles] || "";
	}

	/**
	 * Map BankAccount type to Account type
	 */
	private mapBankAccountType(bankAccountType: "checking" | "savings" | "credit" | "investment"): AccountType {
		switch (bankAccountType) {
			case "checking":
			case "savings":
				return AccountType.BANK;
			case "credit":
				return AccountType.CREDIT;
			case "investment":
				return AccountType.INVESTMENT; // Map investment to bank type
			default:
				return AccountType.BANK;
		}
	}
}
