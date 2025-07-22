/// <reference types="jest" />

import { GitHubClient } from '../client';
import { Octokit } from '@octokit/rest';

// Create mock functions
const mockReposGet = jest.fn();
const mockGitGetRef = jest.fn();
const mockGitCreateRef = jest.fn();

// Mock Octokit
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => ({
    repos: {
      get: mockReposGet
    },
    git: {
      getRef: mockGitGetRef,
      createRef: mockGitCreateRef
    }
  }))
}));

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a new client instance
    client = new GitHubClient('test-token');
  });

  describe('createBranch', () => {
    it('should create a new branch and return the branch name', async () => {
      // Mock the current timestamp
      const mockDate = 1234567890000;
      jest.spyOn(Date, 'now').mockImplementation(() => mockDate);

      // Mock the repository info response
      mockReposGet.mockResolvedValueOnce({
        data: {
          default_branch: 'main'
        }
      });

      // Mock the base ref response
      mockGitGetRef.mockResolvedValueOnce({
        data: {
          object: {
            sha: 'test-sha-123'
          }
        }
      });

      // Mock the create ref response
      mockGitCreateRef.mockResolvedValueOnce({
        data: {
          ref: 'refs/heads/papr-staging-1234567890000',
          object: {
            sha: 'new-sha-456'
          }
        }
      });

      // Call the method
      const branchName = await client.createBranch('test-owner', 'test-repo');

      // Verify the branch name is returned correctly
      expect(branchName).toBe('papr-staging-1234567890000');

      // Verify the correct API calls were made
      expect(mockReposGet).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo'
      });

      expect(mockGitGetRef).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ref: 'heads/main'
      });

      expect(mockGitCreateRef).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ref: 'refs/heads/papr-staging-1234567890000',
        sha: 'test-sha-123'
      });
    });

    it('should handle branch creation errors', async () => {
      // Mock the repository info response
      mockReposGet.mockResolvedValueOnce({
        data: {
          default_branch: 'main'
        }
      });

      // Mock the base ref response
      mockGitGetRef.mockResolvedValueOnce({
        data: {
          object: {
            sha: 'test-sha-123'
          }
        }
      });

      // Mock a 422 error for branch creation
      mockGitCreateRef.mockRejectedValueOnce({
        status: 422,
        message: 'Reference already exists'
      });

      // Verify error handling
      await expect(client.createBranch('test-owner', 'test-repo'))
        .rejects
        .toThrow('Branch already exists or invalid SHA');
    });
  });
}); 