Feature: Document RAG (Retrieval-Augmented Generation)
  As a Rutgers student
  I want to upload documents and ask questions about them
  So that the AI answers are grounded in my actual course materials

  Background:
    Given I am registered and logged in

  Scenario: Upload a plain text document successfully
    When I upload a text file named "lecture.txt" with content "Photosynthesis converts light to energy"
    Then the upload should succeed
    And "lecture.txt" should appear in my document list

  Scenario: Uploaded document content is injected into the LLM context
    Given I have uploaded a document with content "The final exam is on December 15th"
    And I have an active chat
    When I send a message with that document selected
    Then the LLM should receive the document content in the system prompt

  Scenario: Multiple documents are combined into context
    Given I have uploaded a document with content "Chapter 1 covers arrays"
    And I have uploaded a document with content "Chapter 2 covers linked lists"
    And I have an active chat
    When I send a message with all documents selected
    Then the LLM should receive both documents in the system prompt

  Scenario: Delete a document removes it from the list
    Given I have uploaded a document with content "Temporary notes"
    When I delete that document
    Then my document list should be empty

  Scenario: Unsupported file type is rejected
    When I try to upload a file named "image.jpg" with type "image/jpeg"
    Then the upload should fail with status 415

  Scenario: Another user's document is not accessible
    Given another user has uploaded a document with content "Private research data"
    And I have an active chat
    When I send a message referencing that other user's document
    Then the LLM should not receive "Private research data" in the system prompt
