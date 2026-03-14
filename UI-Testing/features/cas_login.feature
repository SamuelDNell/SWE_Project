Feature: RU CAS Login

  Scenario: User is redirected to RU CAS login
    Given I am on the landing page
    When I click the RU CAS login button
    Then I should be redirected to the Rutgers CAS login page

  Scenario: User returns from CAS and is logged in
    Given I have authenticated through RU CAS
    When I am redirected back to the app
    Then I should be logged in to my account