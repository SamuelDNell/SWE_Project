Feature: User Login
Scenario: Successful login
Given I am on the login page
When I enter a valid login username and password
Then I should be logged in

Scenario: Incorrect password
Given I am on the login page
When I enter a valid username and invalid password
Then I should see an incorrect password error message

Scenario: Incorrect username
Given I am on the login page
When I enter an invalid username
Then I should see a invalid username error message

Scenario: Missing credentials
Given I am on the login page
When I do not enter a username or password
Then I should see a missing credentials error message 