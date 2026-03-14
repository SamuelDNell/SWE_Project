Feature: User signup
Scenario: Successful signup
Given I am on the signup page
When I enter a valid username and password
Then my account should be created

Scenario: Taken username
Given I am on the signup page
When I enter a username that already exists
Then I should get username already exists error message

Scenario: Password does not meet requirements
Given I am on the signup page
When I enter a password that does not meet requirements
Then I should get password does not meet requirements error message

Scenario: Missing required fields
Given I am on the signup page
When I do not enter the required fields
Then I should get missing required fields error message