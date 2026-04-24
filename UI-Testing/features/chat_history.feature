Feature: Chat history

  Scenario: A logged-in user can reopen a previous conversation from history
    Given I am logged in and have created a conversation
    When I open the chat history page
    Then I should see my conversation listed with a title and updated timestamp
    When I reopen the conversation from history
    Then I should be taken back to the full conversation
