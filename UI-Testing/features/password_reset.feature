Feature: Password Reset

  Scenario: User requests a password reset with an unregistered email
    Given I am on the forgot password page
    When I enter an unregistered email address
    Then I should see an error that the email is not found
